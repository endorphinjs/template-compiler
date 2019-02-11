import { SourceNode } from 'source-map';
import * as Ast from '../ast/template';
import * as JSAst from '../ast/expression';
import { ENDCompileError } from '../parser/syntax-error';
import CompileScope, { RuntimeSymbols as Symbols, CompileScopeOptions } from './scope';
import { ChunkList, qStr, SourceNodeFactory, sn, format, Chunk, isIdentifier, propAccessor, tagToJS, isDynamicAttribute } from './utils';
import getStats, { collectDynamicStats, hasRefs } from './node-stats';
import compileExpression from './expression';
import generateEvent from './assets/event';
import generateObject from './assets/object';
import { getAttrValue } from '../parser/elements/utils';

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
        scope.enterFunction('template');
        const body: ChunkList = [].concat(
            scope.enterElement('target', `${scope.host}.componentView`, collectDynamicStats(node)),
            node.body.map(next),
            scope.exitElement(),
        );

        if (hasRefs(node)) {
            const refs = `${scope.use(Symbols.finalizeRefs)}(${scope.host});`;
            scope.pushUpdate(refs);
            body.push(refs);
        }

        return sn(node, [`export default `, scope.exitFunction(body)]);
    },
    ENDElement(node: Ast.ENDElement, scope, sn, next) {
        const elemName = node.name.name;
        const stats = getStats(node);
        let elem: SourceNode;
        let { attributes, body } = node;

        if (scope.isComponent(elemName)) {
            // Create component
            elem = sn(node, [`${scope.use(Symbols.createComponent)}(${qStr(elemName)}, ${scope.componentsMap.get(elemName).symbol}, ${scope.host})`]);
        } else if (stats.text) {
            // Create plain DOM element with static text
            elem = sn(node.name, [
                `${scope.use(Symbols.elemWithText)}(${qStr(elemName)}, `,
                sn(stats.text, qStr(stats.text.value)),
                `, ${scope.host})`
            ]);
            body = null;
        } else {
            // Create plain DOM element
            elem = sn(node.name, `${scope.use(Symbols.elem)}(${qStr(elemName)}, ${scope.host})`);
        }

        // Mount element
        const mount = new SourceNode();

        if (scope.requiresInjector()) {
            const slotName = getAttrValue(node, 'slot');
            mount.add(sn(node, [`${scope.use(Symbols.insert)}(${scope.localInjector()}, `, elem, slotName ? `, ${qStr(String(slotName))}` : '', ')']));
        } else {
            mount.add(sn(node, [`${scope.element.localSymbol}.appendChild(`, elem, ')']));
        }

        // Output content
        let chunks: ChunkList = [scope.enterElement(elemName, mount, stats)];

        if (scope.inComponent()) {
            // Redirect input into component injector
            scope.element.injector = `${scope.element.localSymbol}.componentModel.input`;

            // In component, static attributes/props (e.g. ones which won’t change
            // in runtime) must be added during component mount. Thus, we should
            // process dynamic attributes only
            attributes = attributes.filter(attr => isDynamicAttribute(attr, scope));
        }

        if (elemName === 'slot') {
            body = null;
        }

        chunks = chunks.concat(
            attributes.map(next),
            node.directives.map(next),
            body ? body.map(next) : []
        );

        if (scope.inComponent()) {
            const staticAttrs = node.attributes.filter(attr => !isDynamicAttribute(attr, scope));
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
        const valueVar = scope.scopeSymbol('textValue');

        const mount = new SourceNode();
        const update = new SourceNode();

        mount.add(`${nodeVar} = `);

        if (scope.requiresInjector()) {
            mount.add([`${scope.use(Symbols.insert)}(${scope.localInjector()}, ${scope.use(Symbols.text)}(${valueVar} = `, expr, `));`]);
        } else {
            mount.add([`${scope.element.localSymbol}.appendChild(${scope.use(Symbols.text)}(${valueVar} = `, expr, `));`]);
        }

        update.add([`${valueVar} = ${scope.use(Symbols.updateText)}(${nodeVar}, `, expr, `, ${valueVar});`]);
        scope.func.update.push(update);
        return mount;
    },
    ENDInnerHTML(node: Ast.ENDInnerHTML, scope, sn) {
        const blockExpr = createExpressionFunction('getHTML', scope, sn, node.value);
        const blockSymbol = scope.scopeSymbol('html');

        scope.func.update.push(`${scope.use(Symbols.updateInnerHTML)}(${blockSymbol});`);

        return sn(node, [
            `${blockSymbol} = ${scope.use(Symbols.mountInnerHTML)}`,
            `(${scope.host}, ${scope.localInjector()}, ${blockExpr});`
        ]);
    },
    ENDAttributeStatement(node: Ast.ENDAttributeStatement, scope, sn, next) {
        return sn(node, [].concat(
            node.attributes.map(next),
            node.directives.map(next)
        ));
    },
    ENDAttribute(node: Ast.ENDAttribute, scope, sn) {
        if (node.name instanceof JSAst.Identifier && node.name.name === 'ref') {
            // Element reference: ref="name"
            // TODO support static refs
            const refName = compileAttributeValue(node.value, scope, sn);
            scope.pushUpdate(sn(node, [`${scope.use(Symbols.setRef)}(${scope.host}, `, refName, `, ${scope.element.scopeSymbol});`]));
            return sn(node, [`${scope.use(Symbols.setRef)}(${scope.host}, `, refName, `, ${scope.element.localSymbol});`]);
        }

        const outputName = compileAttributeName(node.name, scope, sn);
        const outputValue = compileAttributeValue(node.value, scope, sn);

        // Dynamic attributes must be handled by runtime and re-rendered on update
        if (isDynamicAttribute(node, scope) || scope.inComponent()) {
            const ref = scope.updateSymbol('injector', scope.scopeInjector());
            scope.pushUpdate(sn(node, [`${scope.use(Symbols.setAttribute)}(${ref}, `, outputName, ', ', outputValue, `);`]));
            return sn(node, [`${scope.use(Symbols.setAttribute)}(${scope.localInjector()}, `, outputName, ', ', outputValue, `);`]);
        }

        return sn(node, [`${scope.element.localSymbol}.setAttribute(`, outputName, ', ', outputValue, `);`]);
    },
    ENDDirective(node: Ast.ENDDirective, scope, sn) {
        if (node.prefix === 'on') {
            return generateEvent(node, scope, sn);
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
            value = `${fnName}(${scope.host})`;
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
        output.add([name, ` = `, value, ';']);
        scope.func.update.push(output);
        return output;
    },
    ENDIfStatement(node: Ast.ENDIfStatement, scope, sn, next) {
        // Edge case: if statement contains attributes only, we can create much simpler
        // function
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

            // Reset update code since the very save function will be used for
            // element update
            scope.func.update.length = 0;
            const { scopeArg } = scope.func;
            const curFunc = scope.func;
            scope.push(scope.exitFunction([body]));

            // If shorthand function requires scope argument, mark scope as used in
            // outer function as well
            if (curFunc.scopeArg.children.length) {
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

        scope.func.update.push(`${scope.use(node.key ? Symbols.updateKeyIterator : Symbols.updateIterator)}(${blockSymbol});`);

        return sn(node, [
            `${blockSymbol} = ${scope.use(node.key ? Symbols.mountKeyIterator : Symbols.mountIterator)}`,
            `(${scope.host}, ${scope.localInjector()}, ${blockExpr}${node.key ? `, ${blockKey}` : ''}, ${blockContent});`
        ]);
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
        const update = new SourceNode();
        update.add([`${scope.use(Symbols.updatePartial)}(${symbol}, ${getter}, `, params, `);`]);

        scope.func.update.push(update);
        return sn(node, [`${symbol} = ${scope.use(Symbols.mountPartial)}(${scope.host}, ${scope.localInjector()}, ${getter}, `, params, `);`]);
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

function compileAttributeName(name: Ast.ENDAttributeName, scope: CompileScope, sn: SourceNodeFactory): Chunk {
    if (name instanceof JSAst.Identifier) {
        // Static attribute name
        return qStr(name.name);
    }

    if (name instanceof JSAst.Program) {
        // Dynamic attribute name
        return compileExpression(name, scope);
    }
}

function compileAttributeValue(value: Ast.ENDAttributeValue, scope: CompileScope, sn: SourceNodeFactory): Chunk {
    if (value === null) {
        // Static boolean attribute
        return qStr('');
    }

    if (value instanceof JSAst.Literal) {
        // Static string attribute
        return qStr(String(value.value != null ? value.value : ''));
    }

    if (value instanceof JSAst.Program) {
        // Dynamic expression, must be compiled to function
        return compileExpression(value, scope);
    }

    if (value instanceof Ast.ENDAttributeValueExpression) {
        // List of static and dynamic tokens, must be compiled to function
        const fnName = createConcatFunction('attrValue', scope,
            value.elements.map(elem => elem instanceof JSAst.Literal ? String(elem.value) : elem))
        return `${fnName}(${scope.host})`;
    }
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

function createConcatFunction(prefix: string, scope: CompileScope, tokens: Array<string | JSAst.Program>): string {
    const fnName = scope.enterFunction(prefix);
    const body = new SourceNode();

    body.add('return ');
    tokens.forEach((token, i) => {
        if (i !== 0) {
            body.add(' + ');
        }
        if (token instanceof JSAst.Program) {
            body.add(['(', compileExpression(token, scope), ')']);
        } else {
            body.add(qStr(token));
        }
    });
    body.add(';');

    scope.push(scope.exitFunction([body]));
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
    scope.func.update.push(sn(node, `${scope.use(Symbols.updateBlock)}(${blockVar});`));

    return sn(node, `${blockVar} = ${scope.use(Symbols.mountBlock)}(${scope.host}, ${scope.localInjector()}, ${blockEntry});`);
}

function isSimpleConditionContent(node: Ast.ENDNode): boolean {
    if (node instanceof Ast.ENDAttributeStatement) {
        return node.directives.filter(dir => dir.prefix === 'on').length === 0;
    }

    return node instanceof Ast.ENDAddClassStatement;
}

function generateSlot(node: Ast.ENDElement, scope: CompileScope, sn: SourceNodeFactory, next: Generator): SourceNode {
    if (!node.body.length) {
        // Slot doesn’t have default content: no need to mount block
        scope.func.update.push(sn(node, `${scope.use(Symbols.renderSlot)}(${scope.element.scopeSymbol}, ${scope.host}.slots);`));
        return sn(node, `${scope.use(Symbols.renderSlot)}(${scope.element.localSymbol}, ${scope.host}.slots);`);
    }

    const indent = scope.indent;
    const innerIndent = indent.repeat(2);
    const slotName = String(getAttrValue(node, 'name') || '');
    const blockVar = scope.scopeSymbol('slot');

    const renderSlot = `${scope.use(Symbols.renderSlot)}(injector.parentNode, ${scope.host}.slots)`;
    const blockEntry = scope.enterFunction(`slot${tagToJS(slotName || 'default', true)}`, 'injector');
    const blockContent = createContentFunction(`slot${tagToJS(slotName || 'default', true)}Content`, scope, node.body, next);

    scope.push(scope.exitFunction([`if(!${renderSlot}) {\n${innerIndent}return ${blockContent};\n${indent}}`]));

    scope.func.update.push(sn(node, `${scope.use(Symbols.updateBlock)}(${blockVar});`));

    return sn(node, `${blockVar} = ${scope.use(Symbols.mountBlock)}(${scope.host}, ${scope.localInjector()}, ${blockEntry});`);
}
