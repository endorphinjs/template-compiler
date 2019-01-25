import { SourceNode } from 'source-map';
import * as Ast from '../ast/template';
import * as JSAst from '../ast/expression';
import { ENDSyntaxError } from '../parser/syntax-error';
import CompileScope, { RuntimeSymbols as Symbols } from './scope';
import { ChunkList, qStr, SourceNodeFactory, sn, format, Chunk, isIdentifier } from './utils';
import getStats, { collectDynamicStats } from './node-stats';
import compileExpression, { generate } from './expression';
import generateEvent from './assets/event';

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
        // TODO compile partial
        scope.enterFunction('template');
        const body: ChunkList = [].concat(
            scope.enterElement('target', `${scope.host}.componentView`, collectDynamicStats(node)),
            node.body.map(next),
            scope.exitElement(),
        );

        return sn(node, [`export default `, scope.exitFunction(body)]);
    },
    ENDElement(node: Ast.ENDElement, scope, sn, next) {
        // TODO handle components
        const stats = getStats(node);
        const elemName = node.name.name;
        const elem: SourceNode = !stats.text
            ? sn(node.name, `${scope.use(Symbols.elem)}(${qStr(elemName)}, ${scope.host})`)
            : sn(node.name, [
                `${scope.use(Symbols.elemWithText)}(${qStr(elemName)}, `,
                sn(stats.text, qStr(stats.text.value)),
                `, ${scope.host})`
            ]);

        // Mount element
        const mount = new SourceNode();

        if (scope.requiresInjector()) {
            mount.add(sn(node, [`${scope.use(Symbols.insert)}(${scope.localInjector()}, `, elem, ')']));
        } else {
            mount.add(sn(node, [`${scope.element.localSymbol}.appendChild(`, elem, ')']));
        }

        // Output content
        const chunks: ChunkList = [].concat(
            scope.enterElement(elemName, mount, stats),
            node.attributes.map(next),
            node.directives.map(next),
            !stats.text ? node.body.map(next) : [],
            scope.exitElement()
        );

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
            mount.add([`${scope.use(Symbols.insert)}(${scope.localInjector()}, ${scope.use(Symbols.text)}(${valueVar} = `, expr, `);`]);
        } else {
            mount.add([`${scope.element.localSymbol}.appendChild(${scope.use(Symbols.text)}(${valueVar} = `, expr, `));`]);
        }

        update.add([`${valueVar} = ${scope.use(Symbols.updateText)}(${nodeVar}, `, expr, `, ${valueVar});`]);
        scope.func.update.push(update);
        return mount;
    },
    ENDAttributeStatement(node: Ast.ENDAttributeStatement, scope, sn, next) {
        return sn(node, [].concat(
            node.attributes.map(next),
            node.directives.map(next)
        ));
    },
    ENDAttribute(node: Ast.ENDAttribute, scope, sn) {
        const outputName = compileAttributeName(node.name, scope, sn);
        const outputValue = compileAttributeValue(node.value, scope, sn);

        // Dynamic attributes must be handled by runtime and re-rendered on update
        if (isDynamicAttribute(node, scope)) {
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

        const output = sn(node, [name, ` = `, value, ';']);
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
            body.add([`if (`, generate(node.test, scope), ') {']);
            node.consequent.forEach(node => {
                body.add(['\n', indent, next(node)]);
            });
            body.add(`\n${scope.indent}}`);

            // Reset update code since the very save function will be used for
            // element update
            scope.func.update.length = 0;
            const { scopeArg } = scope.func;
            scope.push(scope.exitFunction([body]));
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
    }
};

export default function compileTemplate(program: Ast.ENDProgram, scope: CompileScope = new CompileScope()): SourceNode {
    const compile: Generator = node => {
        if (node.type in generators) {
            return generators[node.type](node, scope, sn, compile);
        }

        throw new ENDSyntaxError(`${node.type} is not supported in templates`,
            node.loc && node.loc.source, node.loc && node.loc.start);
    };

    const templates: ChunkList = [];
    program.body.forEach(node => {
        if (node instanceof Ast.ENDTemplate) {
            templates.push(compile(node));
        }
    });

    let body: ChunkList = [];

    // Import runtime symbols, used by template
    if (scope.runtimeSymbols.size) {
        body.push(`import { ${Array.from(scope.runtimeSymbols).map(symbol => Symbols[symbol]).join(', ')} } from "${scope.options.module}";`);
    }

    // In most cases, templates and scope body are function declarations
    templates.concat(scope.body).forEach(chunk => {
        body.push('\n\n', chunk);
    });

    return sn(program, body);
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

function isDynamicAttribute(attr: Ast.ENDAttribute, scope: CompileScope): boolean {
    if (!scope.element) {
        return true;
    }

    const stats = scope.element.stats;
    if (stats.hasPartials || stats.attributeExpressions) {
        return true;
    }

    if (attr.name instanceof JSAst.Identifier) {
        return stats.dynamicAttributes.has(attr.name.name);
    }

    return attr.name instanceof JSAst.Program
        || attr.value instanceof JSAst.Program
        || attr.value instanceof Ast.ENDAttributeValueExpression;
}

function generateConditionalBlock(node: Ast.ENDNode, blocks: ConditionStatement[], scope: CompileScope, sn: SourceNodeFactory, next: Generator): SourceNode {
    const indent = scope.indent;
    const innerIndent = indent.repeat(2);

    // Block entry point
    const blockEntry = scope.enterFunction('conditionEntry');
    const blockEntryBody = new SourceNode();
    blocks.forEach((block, i) => {
        if (i === 0) {
            blockEntryBody.add([`if (`, generate(block.test, scope), ')']);
        } else if (block.test) {
            blockEntryBody.add([`else if (`, generate(block.test, scope), ')']);
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
