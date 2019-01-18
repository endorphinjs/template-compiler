import { SourceNode } from 'source-map';
import * as Ast from '../ast/template';
import * as JSAst from '../ast/expression';
import { ENDSyntaxError } from '../parser/syntax-error';
import CompileScope, { RuntimeSymbols as Symbols } from './scope';
import { ChunkList, qStr, SourceNodeFactory, sn, Chunk } from './utils';
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
        const elemSymbol = 'target';

        const body: ChunkList = format([].concat(
            `const ${elemSymbol} = ${scope.host}.componentView;`,
            scope.enterTemplate(),
            scope.enterElement(elemSymbol, collectDynamicStats(node)),
            node.body.map(next),
            scope.exitElement(),
            scope.exitTemplate(scope.createSymbol('update'))
        ), scope.indent);

        body.unshift(`export default function ${scope.createSymbol('mount')}(${scope.host}) {\n${scope.indent}`);
        body.push('\n}\n');

        return sn(node, body);
    },
    ENDElement(node: Ast.ENDElement, scope, sn, next) {
        // TODO handle components
        const stats = getStats(node);
        const elemName = node.name.name;
        const varName = scope.localSymbol(elemName);
        const elem: SourceNode = !stats.text
            ? sn(node.name, `${scope.use(Symbols.elem)}(${qStr(elemName)}, ${scope.host})`)
            : sn(node.name, [
                `${scope.use(Symbols.elemWithText)}(${qStr(elemName)}, `,
                sn(stats.text, qStr(stats.text.value)),
                `, ${scope.host})`
            ]);

        // Mount element
        const decl = new SourceNode();

        // Check if template requires variable reference
        if (node.attributes.length || node.directives.length) {
            decl.add(`const ${varName} = `);
        }

        if (scope.requiresInjector()) {
            decl.add(sn(node, [`${scope.use(Symbols.insert)}(${scope.injector()}, `, elem, ');']));
        } else {
            decl.add(sn(node, [`${scope.element.symbol}.appendChild(`, elem, ');']));
        }

        // Output content
        const chunks: ChunkList = [].concat(
            decl,
            scope.enterElement(varName, stats),
            node.attributes.map(next),
            node.directives.map(next),
            !stats.text ? node.body.map(next) : [],
            scope.exitElement()
        );

        return sn(node, format(chunks, scope.indent));
    },
    ENDText(node: Ast.ENDText, scope, sn) {
        if (scope.requiresInjector()) {
            return sn(node, [`${scope.use(Symbols.insert)}(${scope.injector()}, ${scope.use(Symbols.text)}(`, qStr(node.value), '));'])
        }

        return sn(node, [`${scope.element.symbol}.appendChild(${scope.use(Symbols.text)}(`, qStr(node.value), '));']);
    },
    Program(node: JSAst.Program, scope, sn) {
        // NB expression for text node
        const fn = createExpressionFunction('textValue', scope, sn, node);
        const textVar = scope.localSymbol('text');
        const getter = `${fn}(${scope.host})`;
        scope.template.update.push(`${textVar}.textContent = ${getter};`);

        if (scope.requiresInjector()) {
            return sn(node, [`const ${textVar} = ${scope.use(Symbols.insert)}(${scope.injector()}, ${scope.use(Symbols.text)}(${getter}));`]);
        }

        return sn(node, [`const ${textVar} = ${scope.element.symbol}.appendChild(${scope.use(Symbols.text)}(${getter}));`]);
    },
    ENDAttributeStatement(node: Ast.ENDAttributeStatement, scope, sn, next) {
        return sn(node, node.attributes.map(next));
    },
    ENDAttribute(node: Ast.ENDAttribute, scope, sn) {
        const outputName = compileAttributeName(node.name, scope, sn);
        const outputValue = compileAttributeValue(node.value, scope, sn);

        // Dynamic attributes must be handled by runtime and re-rendered on update
        if (isDynamicAttribute(node)) {
            const output = sn(node, [`${scope.use(Symbols.setAttribute)}(${scope.injector()}`, outputName, ', ', outputValue, ');']);
            scope.template.update.push(output);
            return output;
        }

        return sn(node, `${scope.element.symbol}.setAttribute(${outputName}, ${outputValue});`);
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
            const output = sn(node, [`${scope.use(Symbols.addClass)}(${scope.injector()}, ${value});`]);
            scope.template.update.push(output);
            return output;
        }
    },
    ENDVariableStatement(node: Ast.ENDVariableStatement, scope, sn, next) {
        return sn(node, node.variables.map(next));
    },
    ENDVariable(node: Ast.ENDVariable, scope, sn) {
        const outputName = compileAttributeName(node.name, scope, sn);
        const outputValue = compileAttributeValue(node.value, scope, sn);

        const output = sn(node, [`${scope.use(Symbols.setVar)}(${scope.host}`, outputName, ', ', outputValue, ');']);
        scope.template.update.push(output);
        return output;
    },
    ENDIfStatement(node: Ast.ENDIfStatement, scope, sn, next) {
        const blocks: ConditionStatement[] = [{
            test: node.test,
            consequent: node.consequent,
        }];

        return generateConditionalBlock(node, blocks, scope, sn, next);
    },
    ENDChooseStatement(node: Ast.ENDChooseStatement, scope, sn, next) {
        const blocks: ConditionStatement[] = node.cases.map(item => {
            return {
                test: item.test,
                consequent: item.consequent
            }
        });

        return generateConditionalBlock(node, blocks, scope, sn, next);
    },
    ENDForEachStatement(node: Ast.ENDForEachStatement, scope, sn, next) {
        const blockExpr = createExpressionFunction('iteratorExpr', scope, sn, node.select);
        const blockKey: string = node.key ? createExpressionFunction('iteratorKey', scope, sn, node.key) : null;
        const blockContent = createContentFunction('iteratorBlock', scope, node.body, next);
        const blockSymbol = scope.localSymbol('iter');

        scope.template.update.push(`${scope.use(node.key ? Symbols.updateKeyIterator : Symbols.updateIterator)}(${blockSymbol});`);

        return sn(node, [
            `const ${blockSymbol} = ${scope.use(node.key ? Symbols.mountKeyIterator : Symbols.mountIterator)}`,
            `(${scope.host}, ${scope.injector()}${blockExpr}${node.key ? `, ${blockKey}` : ''}, ${blockContent});`
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
    if (scope.symbols.size) {
        body.push(`import { ${Array.from(scope.symbols).map(symbol => Symbols[symbol]).join(', ')} } from "${scope.options.module}";`);
    }

    // In most cases, templates and scope body are function declarations
    templates.concat(scope.body).forEach(chunk => {
        body.push('\n\n', chunk);
    });

    return sn(program, body);
}

function compileAttributeName(name: Ast.ENDAttributeName, scope: CompileScope, sn: SourceNodeFactory): string {
    if (name instanceof JSAst.Identifier) {
        // Static attribute name
        return qStr(name.name);
    }

    if (name instanceof JSAst.Program) {
        // Dynamic attribute name
        return `${createExpressionFunction('attrName', scope, sn, name)}(${scope.host})`;
    }
}

function compileAttributeValue(value: Ast.ENDAttributeValue, scope: CompileScope, sn: SourceNodeFactory): string {
    if (value === null) {
        // Static boolean attribute
        return qStr('');
    }

    if (value instanceof JSAst.Literal) {
        // Static string attribute
        return qStr(String(value.value));
    }

    if (value instanceof JSAst.Program) {
        // Dynamic expression, must be compiled to function
        return `${createExpressionFunction('attrValue', scope, sn, value)}(${scope.host})`;
    }

    if (value instanceof Ast.ENDAttributeValueExpression) {
        // List of static and dynamic tokens, must be compiled to function
        const fnName = createConcatFunction('attrValue', scope,
            value.elements.map(elem => elem instanceof JSAst.Literal ? String(elem.value) : elem))
        return `${fnName}(${scope.host})`;
    }
}

function createExpressionFunction(prefix: string, scope: CompileScope, sn: SourceNodeFactory, value: JSAst.Program): string {
    const fnName = scope.createSymbol(prefix);
    scope.push(sn(value, [`function ${fnName}(${scope.host}) {\n`,
        `${scope.indent}return `,
        compileExpression(value, scope),
        `;\n}`]));

    return fnName;
}

function createContentFunction(prefix: string, scope: CompileScope, statements: Ast.ENDStatement[], next: Generator): string {
    const fnName = scope.createSymbol(prefix);
    const injectorSymbol = 'injector';

    const body: ChunkList = [].concat(
        scope.enterTemplate(injectorSymbol),
        statements.map(next),
        scope.exitTemplate(`update_${fnName}`)
    );

    const output = new SourceNode();
    output.add(`function ${fnName}(${scope.host}, ${injectorSymbol}) {\n${scope.indent}`);
    output.add(format(body, scope.indent));
    output.add('\n}\n');

    scope.push(output);

    return fnName;
}

function createConcatFunction(prefix: string, scope: CompileScope, tokens: Array<string | JSAst.Program>): string {
    const fnName = scope.createSymbol(prefix);
    const output = new SourceNode();
    output.add(`function ${fnName}(${scope.host}) {\n${scope.indent}return `);

    tokens.forEach((token, i) => {
        if (i !== 0) {
            output.add(' + ');
        }
        if (token instanceof JSAst.Program) {
            output.add(['(', compileExpression(token, scope), ')']);
        } else {
            output.add(qStr(token));
        }
    });
    output.add('\n}');
    scope.push(output);
    return fnName;
}

function isDynamicAttribute(attr: Ast.ENDAttribute): boolean {
    return attr.name instanceof JSAst.Program
        || attr.value instanceof JSAst.Program
        || attr.value instanceof Ast.ENDAttributeValueExpression;
}

function format(chunks: ChunkList, prefix: string = '', suffix: string = '\n'): ChunkList {
    const result: ChunkList = [];

    chunks.filter(isValidChunk).forEach((chunk, i, arr) => {
        if (i !== 0) {
            result.push(prefix);
        }

        result.push(chunk);

        if (i !== arr.length - 1) {
            result.push(suffix);
        }
    });
    return result;
}

function isValidChunk(chunk: Chunk): boolean {
    return chunk instanceof SourceNode
        ? chunk.children.length !== 0
        : chunk.length !== 0;
}

function generateConditionalBlock(node: Ast.ENDNode, blocks: ConditionStatement[], scope: CompileScope, sn: SourceNodeFactory, next: Generator): SourceNode {
    const indent = scope.indent;

    // Block entry point
    const blockEntry = scope.createSymbol('conditionBlock');
    const entryFunction = new SourceNode();
    const innerIndent = indent.repeat(2);

    entryFunction.add(`function ${blockEntry}(${scope.host}) {\n${indent}`);
    blocks.forEach((block, i) => {
        if (i === 0) {
            entryFunction.add([`if (`, generate(block.test, scope), ')']);
        } else if (block.test) {
            entryFunction.add([`else if (`, generate(block.test, scope), ')']);
        } else {
            entryFunction.add('else');
        }

        const blockContent = createContentFunction('conditionContent', scope, block.consequent, next);
        entryFunction.add(` {\n${innerIndent}return ${blockContent};\n${indent}} `);
    });

    entryFunction.add('\n}');

    scope.push(entryFunction);

    const blockVar = scope.localSymbol('block');
    scope.template.update.push(sn(node, `${scope.use(Symbols.updateBlock)}(${blockVar});`));

    return sn(node, `const ${blockVar} = ${scope.use(Symbols.mountBlock)}(${scope.host}, ${scope.injector()}, ${blockEntry});`);
}
