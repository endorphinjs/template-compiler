import { SourceNode } from 'source-map';
import * as Ast from '../ast/template';
import * as JSAst from '../ast/expression';
import { ENDCompileError } from '../parser/syntax-error';
import CompileScope, { RuntimeSymbols as Symbols, CompileScopeOptions } from './scope';
import { ChunkList, qStr, SourceNodeFactory, sn, format, isIdentifier, propAccessor, tagToJS, isDynamicAttribute, wrapSN, cssScopeArg } from './utils';
import getStats, { collectDynamicStats, ElementStats } from './node-stats';
import compileExpression from './expression';
import generateAnimation from './assets/animation';
import generateEvent from './assets/event';
import generateObject from './assets/object';
import { getAttrValue, getControlName } from '../parser/elements/utils';
import { compileAttributeName, compileAttributeValue, createConcatFunction, getAttributeNS } from './assets/attribute';

type TemplateEntry = Ast.ENDNode;

/**
 * Code generator continuation function
 */
interface Generator {
    (node: TemplateEntry): SourceNode
}

/**
 * Code generator for AST node of specific type
 */
interface NodeGenerator<T extends TemplateEntry> {
    (node: T, scope: CompileScope, sn: SourceNodeFactory, next: Generator): SourceNode;
}

interface NodeGeneratorMap {
    [type: string]: NodeGenerator<TemplateEntry>
}

interface ConditionStatement {
    test?: JSAst.Program;
    consequent: Ast.ENDStatement[]
}

const generators: NodeGeneratorMap = {
    ENDTemplate(node: Ast.ENDTemplate, scope, sn, next) {
        const stats = collectDynamicStats(node);
        scope.enterFunction('template');
        const body: ChunkList = [].concat(
            scope.enterElement('target', `${scope.host}.componentView`, stats),
            node.body.map(next),
            scope.exitElement(),
        );

        if (hasRefs(scope)) {
            const refs = `${scope.use(Symbols.finalizeRefs)}(${scope.host});`;
            scope.pushUpdate(refs);
            body.push(refs);
        }

        // Subscribe to store updates
        if (scope.usedStore.size) {
            let storeKeys: string = '';
            // Without partials, we can safely assume that we know about
            // all used store keys
            if (!stats.hasPartials) {
                storeKeys = `, [${Array.from(scope.usedStore).map(qStr).join(', ')}]`;
            }
            body.push(`${scope.use(Symbols.subscribeStore)}(${scope.host}${storeKeys});`);
        }

        return sn(node, [`export default `, scope.exitFunction(body)]);
    },
    ENDElement(node: Ast.ENDElement, scope, sn, next) {
        const elemName = node.name.name;
        const stats = getStats(node);
        const xmlns = getAttrValue(node, 'xmlns');
        const mount = new SourceNode();

        scope.checkComponent(node);
        scope.enterNamespace(xmlns);

        const elem = createElement(node, scope, stats);
        let { attributes, body } = node;

        if (scope.requiresInjector()) {
            const slotName = getAttrValue(node, 'slot');
            mount.add(sn(node, [`${scope.use(Symbols.insert)}(${scope.localInjector()}, `, elem, slotName ? `, ${qStr(String(slotName))}` : '', ')']));
        } else {
            mount.add(sn(node, [`${scope.element.localSymbol}.appendChild(`, elem, ')']));
        }

        // Output content
        let chunks: ChunkList = [scope.enterElement(elemName, mount, stats)];

        // NB: `null` is valid value and means “implicit default slot”
        let slotName: string = null;

        if (scope.inComponent()) {
            // Redirect input into component injector
            scope.element.injector = `${scope.element.localSymbol}.componentModel.input`;

            // In component, static attributes/props (e.g. ones which won’t change
            // in runtime) must be added during component mount. Thus, we should
            // process dynamic attributes only
            attributes = attributes.filter(attr => isDynamicAttribute(attr, scope) || isRef(attr));
            slotName = '';
        } else {
            const slotAttr = getAttrValue(node, 'slot');
            if (slotAttr) {
                slotName = String(slotAttr);
            }
        }

        scope.enterSlotContext(slotName);

        chunks = chunks.concat(
            attributes.map(next),
            node.directives.map(next),
            // Do not create plain body content for slots and elements with static text
            body && elemName !== 'slot' && !stats.text ? body.map(next) : []
        );

        scope.exitSlotContext(slotName);

        if (scope.inComponent()) {
            const staticAttrs = node.attributes.filter(attr => !isDynamicAttribute(attr, scope) && !isRef(attr));
            if (staticAttrs.length) {
                const mountComponent = new SourceNode();
                mountComponent.add([`${scope.use(Symbols.mountComponent)}(${scope.element.localSymbol}, `, generateObject(staticAttrs, scope, sn, 1), `);`]);
                chunks.push(mountComponent);
            } else {
                chunks.push(`${scope.use(Symbols.mountComponent)}(${scope.element.localSymbol});`);
            }

            scope.pushUpdate(`${scope.use(Symbols.updateComponent)}(${scope.element.scopeSymbol});`);
        }

        if (elemName === 'slot') {
            chunks.push(generateSlot(node, scope, sn, next));
        }

        chunks.push(scope.exitElement());
        scope.exitNamespace(xmlns);

        return sn(node, format(chunks, scope.indent));
    },
    ENDText(node: Ast.ENDText, scope, sn) {
        if (scope.requiresInjector()) {
            return sn(node, [`${scope.use(Symbols.insert)}(${scope.localInjector()}, ${scope.use(Symbols.text)}(`, qStr(node.value), '));'])
        }

        return sn(node, [`${scope.element.localSymbol}.appendChild(${scope.use(Symbols.text)}(`, qStr(node.value), '));']);
    },
    Program(node: JSAst.Program, scope, sn) {
        // NB `Program` is used as expression for text node
        const expr = compileExpression(node, scope);
        const nodeVar = scope.scopeSymbol('text');

        const mount = new SourceNode();

        mount.add(`${nodeVar} = `);

        if (scope.requiresInjector()) {
            mount.add([`${scope.use(Symbols.insert)}(${scope.localInjector()}, ${scope.use(Symbols.text)}(`, expr, `));`]);
        } else {
            mount.add([`${scope.element.localSymbol}.appendChild(${scope.use(Symbols.text)}(`, expr, `));`]);
        }

        scope.pushUpdate(wrapSN([`${scope.use(Symbols.updateText)}(${nodeVar}, `, expr, `);`]));
        scope.pushUnmount(nodeVar);

        return mount;
    },
    ENDInnerHTML(node: Ast.ENDInnerHTML, scope, sn) {
        const blockExpr = createExpressionFunction('getHTML', scope, sn, node.value);
        const blockSymbol = scope.scopeSymbol('html');
        const mount = sn(node, `${scope.use(Symbols.mountInnerHTML)}(${scope.host}, ${scope.localInjector()}, ${blockExpr});`);

        scope.pushUpdate(`${scope.use(Symbols.updateInnerHTML)}(${blockSymbol});`);
        scope.pushUnmount(blockSymbol, Symbols.unmountInnerHTML);

        return wrapSN([blockSymbol, ' = ', mount]);
    },
    ENDAttributeStatement(node: Ast.ENDAttributeStatement, scope, sn, next) {
        return sn(node, [].concat(
            node.attributes.map(next),
            node.directives.map(next)
        ));
    },
    ENDAttribute(node: Ast.ENDAttribute, scope, sn) {
        if (isRef(node)) {
            // Element reference: ref="name"
            // TODO support static refs
            const refName = compileAttributeValue(node.value, scope);
            scope.pushUpdate(sn(node, [`${scope.use(Symbols.setRef)}(${scope.host}, `, refName, `, ${scope.element.scopeSymbol});`]));
            return sn(node, [`${scope.use(Symbols.setRef)}(${scope.host}, `, refName, `, ${scope.element.localSymbol});`]);
        }

        const namespace = getAttributeNS(node, scope);

        const inComponent = scope.inComponent();
        const outputName = namespace
            ? qStr(namespace.name)
            : compileAttributeName(node.name, scope);
        const outputValue = compileAttributeValue(node.value, scope, inComponent);

        // Dynamic attributes must be handled by runtime and re-rendered on update
        if (isDynamicAttribute(node, scope) || inComponent) {
            const ref = scope.updateSymbol('injector', scope.scopeInjector());

            if (namespace) {
                // It’s a namespaced attribute
                const nsSymbol = scope.getNamespaceSymbol(namespace.ns);
                scope.pushUpdate(sn(node, [`${scope.use(Symbols.setAttributeNS)}(${ref}, ${nsSymbol}, `, outputName, ', ', outputValue, `);`]));
                return sn(node, [`${scope.use(Symbols.setAttributeNS)}(${scope.localInjector()}, ${nsSymbol}, `, outputName, ', ', outputValue, `);`]);
            }

            scope.pushUpdate(sn(node, [`${scope.use(Symbols.setAttribute)}(${ref}, `, outputName, ', ', outputValue, `);`]));
            return sn(node, [`${scope.use(Symbols.setAttribute)}(${scope.localInjector()}, `, outputName, ', ', outputValue, `);`]);
        }

        return namespace
            ? sn(node, [`${scope.element.localSymbol}.setAttributeNS(${scope.getNamespaceSymbol(namespace.ns)}, `, outputName, ', ', outputValue, `);`])
            : sn(node, [`${scope.element.localSymbol}.setAttribute(`, outputName, ', ', outputValue, `);`]);
    },
    ENDDirective(node: Ast.ENDDirective, scope, sn) {
        if (node.prefix === 'on') {
            return generateEvent(node, scope, sn);
        }

        if (node.prefix === 'animate') {
            return generateAnimation(node, scope, sn);
        }
    },
    ENDAddClassStatement(node: Ast.ENDAddClassStatement, scope, sn, next) {
        let value: string;
        if (node.tokens.length === 1) {
            // Fast path: a single token, either string or expression
            const token = node.tokens[0];
            if (token instanceof Ast.ENDText) {
                value = qStr(token.value);
            } else {
                value = `${createExpressionFunction('class', scope, sn, token)}(${scope.host})`;
            }
        } else if (node.tokens.length) {
            // A combination of text and expression tokens
            const fnName = createConcatFunction('class', scope,
                node.tokens.map(token => token instanceof Ast.ENDText ? token.value : token));
            value = `${fnName}(${scope.host}, ${scope.scope})`;
        }

        if (value) {
            const output = sn(node, [`${scope.use(Symbols.addClass)}(${scope.scopeInjector()}, ${value});`]);
            scope.func.update.push(output);
            return output;
        }
    },
    ENDVariableStatement(node: Ast.ENDVariableStatement, scope, sn, next) {
        return sn(node, node.variables.map(next));
    },
    ENDVariable(node: Ast.ENDVariable, scope, sn) {
        const name = new SourceNode();
        name.add(scope.scope);

        if (node.name instanceof JSAst.Identifier) {
            // Static attribute name
            if (isIdentifier(node.name.name)) {
                name.add(['.', sn(node.name, node.name.name)]);
            } else {
                name.add(['[', qStr(node.name.name), ']']);
            }
        } else if (node.name instanceof JSAst.Program) {
            // Dynamic attribute name
            name.add(['[', compileExpression(node.name, scope), ']']);
        }

        let value: SourceNode;
        if (node.value instanceof JSAst.Literal) {
            value = sn(node.value, JSON.stringify(node.value.value));
        } else if (node.value instanceof JSAst.Program) {
            value = compileExpression(node.value, scope);
        } else {
            value = new SourceNode();
            value.add('null');
        }

        const output = new SourceNode();
        // FIXME this hack will skip slot update accumulation in update code
        // need to think about better solution
        output['$$noUpdate'] = true;
        output.add([name, ` = `, value, ';']);
        scope.func.update.push(output);
        return output;
    },
    ENDIfStatement(node: Ast.ENDIfStatement, scope, sn, next) {
        // Edge case: if statement contains attributes only, we can create much simpler
        // function. Since attributes must be explicitly finalized, always return `0`
        // from function as if nothing has been changed.
        if (node.consequent.every(isSimpleConditionContent)) {
            const fn = scope.enterFunction('ifAttr', 'injector');
            const body = new SourceNode();
            const indent = scope.indent.repeat(2);

            scope.func.element = null;
            body.add([`if (`, compileExpression(node.test, scope), ') {']);
            node.consequent.forEach(node => {
                body.add(['\n', indent, next(node)]);
            });
            body.add(`\n${scope.indent}}`);
            body.add(`\n${scope.indent}return 0;`)

            // Reset update code since the very save function will be used for
            // element update
            scope.func.update.length = 0;
            const { scopeArg } = scope.func;
            scope.push(scope.exitFunction([body]));

            // If shorthand function requires scope argument, mark scope as used in
            // outer function as well
            if (scopeArg.children.length) {
                scope.markScopeAsUsed();
            }

            const ref = scope.updateSymbol('injector', scope.scopeInjector());
            scope.pushUpdate(sn(node, [`${fn}(${scope.host}, ${ref}`, scopeArg, `);`]));

            return sn(node, [`${fn}(${scope.host}, ${scope.localInjector()}`, scopeArg, `);`]);
        }

        return generateConditionalBlock(node, [node], scope, sn, next);
    },
    ENDChooseStatement(node: Ast.ENDChooseStatement, scope, sn, next) {
        return generateConditionalBlock(node, node.cases, scope, sn, next);
    },
    ENDForEachStatement(node: Ast.ENDForEachStatement, scope, sn, next) {
        const blockExpr = createExpressionFunction('iteratorExpr', scope, sn, node.select);
        const blockKey: string = node.key ? createExpressionFunction('iteratorKey', scope, sn, node.key) : null;
        const blockContent = createContentFunction('iteratorBlock', scope, node.body, next);
        const blockSymbol = scope.scopeSymbol('iter');

        const mount = sn(node, [
            `${scope.use(node.key ? Symbols.mountKeyIterator : Symbols.mountIterator)}`,
            `(${scope.host}, ${scope.localInjector()}, ${blockExpr}${node.key ? `, ${blockKey}` : ''}, ${blockContent});`
        ]);

        scope.pushUpdate(`${scope.use(node.key ? Symbols.updateKeyIterator : Symbols.updateIterator)}(${blockSymbol});`);
        scope.pushUnmount(blockSymbol, node.key ? Symbols.unmountKeyIterator : Symbols.unmountIterator);

        return wrapSN([blockSymbol, ' = ', mount]);
    },
    ENDPartial(node: Ast.ENDPartial, scope, sn, next) {
        const symbol = scope.enterFunction(`partial${tagToJS(node.id.name, true)}`, 'injector');

        scope.partialsMap.set(node.id.name, {
            name: symbol,
            defaults: generateObject(node.params, scope, sn, 2)
        });
        return sn(node, scope.exitFunction(node.body.map(next)));
    },
    ENDPartialStatement(node: Ast.ENDPartialStatement, scope, sn) {
        // Generate arguments to pass into partials
        const params = generateObject(node.params, scope, sn, 1);
        const getter = `${scope.host}.props['partial:${node.id.name}'] || ${scope.partials}${propAccessor(node.id.name)}`;
        const symbol = scope.scopeSymbol('partial');

        const mount = sn(node, [`${scope.use(Symbols.mountPartial)}(${scope.host}, ${scope.localInjector()}, ${getter}, `, params, `);`]);
        scope.pushUpdate(wrapSN([`${scope.use(Symbols.updatePartial)}(${symbol}, ${getter}, `, params, `);`]));
        scope.pushUnmount(symbol, Symbols.unmountPartial);

        return wrapSN([symbol, ' = ', mount]);
    }
};

export default function compileToJS(program: Ast.ENDProgram, options?: CompileScopeOptions): SourceNode {
    const scope = new CompileScope(options);
    const compile: Generator = node => {
        if (node.type in generators) {
            return generators[node.type](node, scope, sn, compile);
        }

        throw new ENDCompileError(`${node.type} is not supported in templates`, node);
    };

    // Collect child components. We should do it in separate pass to hoist component
    // definitions before templates are rendered
    program.body.forEach(node => {
        if (node instanceof Ast.ENDImport) {
            scope.componentsMap.set(node.name, {
                symbol: tagToJS(node.name, true),
                href: String(node.href),
                node
            });
        }
    });

    // Compile templates
    program.body.forEach(node => {
        if (node instanceof Ast.ENDTemplate || node instanceof Ast.ENDPartial) {
            scope.body.unshift(compile(node));
        }
    });

    // Output scripts
    program.scripts.forEach(script => {
        if (script.transformed) {
            let transformed: SourceNode;
            if (typeof script.transformed === 'string') {
                transformed = new SourceNode();
                transformed.add(script.transformed);
            } else {
                transformed = script.transformed;
            }

            scope.body.push(transformed);
        } else if (script.content) {
            scope.body.push(sn(script.content, script.content.value));
        } else if (script.url) {
            const node = new SourceNode();
            node.add(`export * from ${qStr(script.url)};`);
            scope.body.push(node);
        }
    });

    return scope.compile();
}

function createExpressionFunction(prefix: string, scope: CompileScope, sn: SourceNodeFactory, value: JSAst.Program): string {
    const fnName = scope.enterFunction(prefix);
    const body = new SourceNode();
    body.add(['return ', compileExpression(value, scope), ';']);
    scope.push(scope.exitFunction([body]));

    return fnName;
}

function createContentFunction(prefix: string, scope: CompileScope, statements: Ast.ENDStatement[], next: Generator): string {
    const fnName = scope.enterFunction(prefix, 'injector');
    const output = scope.exitFunction(statements.map(next));
    scope.push(output);

    return fnName;
}

function generateConditionalBlock(node: Ast.ENDNode, blocks: ConditionStatement[], scope: CompileScope, sn: SourceNodeFactory, next: Generator): SourceNode {
    const indent = scope.indent;
    const innerIndent = indent.repeat(2);

    // Block entry point
    const blockEntry = scope.enterFunction('conditionEntry');
    const blockEntryBody = new SourceNode();
    blocks.forEach((block, i) => {
        if (i === 0) {
            blockEntryBody.add([`if (`, compileExpression(block.test, scope), ')']);
        } else if (block.test) {
            blockEntryBody.add([`else if (`, compileExpression(block.test, scope), ')']);
        } else {
            blockEntryBody.add('else');
        }

        const blockContent = createContentFunction('conditionContent', scope, block.consequent, next);
        blockEntryBody.add(` {\n${innerIndent}return ${blockContent};\n${indent}} `);
    });

    scope.push(scope.exitFunction([blockEntryBody]));

    const blockVar = scope.scopeSymbol('block');
    const mount = sn(node, `${scope.use(Symbols.mountBlock)}(${scope.host}, ${scope.localInjector()}, ${blockEntry});`);

    scope.pushUpdate(sn(node, `${scope.use(Symbols.updateBlock)}(${blockVar});`));
    scope.pushUnmount(blockVar, Symbols.unmountBlock);

    return wrapSN([blockVar, ' = ', mount]);
}

function isSimpleConditionContent(node: Ast.ENDNode): boolean {
    if (node instanceof Ast.ENDAttributeStatement) {
        return node.directives.filter(dir => dir.prefix === 'on').length === 0;
    }

    return node instanceof Ast.ENDAddClassStatement;
}

function generateSlot(node: Ast.ENDElement, scope: CompileScope, sn: SourceNodeFactory, next: Generator): SourceNode {
    const slotSymbol = scope.scopeSymbol('slot');
    const slotName = String(getAttrValue(node, 'name') || '');
    const slotContent: string = node.body.length
        ? createContentFunction(`slot${tagToJS(slotName || 'default', true)}Content`, scope, node.body, next)
        : '';

    const mount = sn(node, `${scope.use(Symbols.mountSlot)}(${scope.host}, ${qStr(slotName)}, ${scope.element.localSymbol}${slotContent ? `, ${slotContent}` : ''});`)
    scope.pushUnmount(slotSymbol, Symbols.unmountSlot);

    return wrapSN([slotSymbol, ' = ', mount]);
}

function isRef(attr: Ast.ENDAttribute): boolean {
    return attr.name instanceof JSAst.Identifier && attr.name.name === 'ref';
}

/**
 * Check if given template contains element references
 */
function hasRefs(scope: CompileScope): boolean {
    return scope.runtimeSymbols.has(Symbols.setRef)
        || scope.runtimeSymbols.has(Symbols.mountPartial);
}

function createElement(node: Ast.ENDElement, scope: CompileScope, stats: ElementStats): SourceNode {
    const elemName = node.name.name;

    if (getControlName(elemName) === 'self') {
        // Create component which points to itself
        return sn(node, [`${scope.use(Symbols.createComponent)}(${scope.host}.nodeName, ${scope.host}.componentModel.definition, ${scope.host})`]);
    }

    if (scope.isComponent(elemName)) {
        // Create component
        return sn(node, [`${scope.use(Symbols.createComponent)}(${qStr(elemName)}, ${scope.componentsMap.get(elemName).symbol}, ${scope.host})`]);
    }

    if (stats.text && elemName !== 'slot') {
        // Create plain DOM element with static text
        if (scope.namespace) {
            return sn(node.name, [
                `${scope.use(Symbols.elemNSWithText)}(${qStr(elemName)}, ${scope.namespace}, `,
                sn(stats.text, qStr(stats.text.value)),
                `${cssScopeArg(scope)})`
            ]);
        }

        return sn(node.name, [
            `${scope.use(Symbols.elemWithText)}(${qStr(elemName)}, `,
            sn(stats.text, qStr(stats.text.value)),
            `${cssScopeArg(scope)})`
        ]);
    }

    // Create plain DOM element
    if (scope.namespace) {
        return sn(node.name, `${scope.use(Symbols.elemNS)}(${qStr(elemName)}, ${scope.namespace}${cssScopeArg(scope)})`);
    }

    return sn(node.name, `${scope.use(Symbols.elem)}(${qStr(elemName)}${cssScopeArg(scope)})`);
}
