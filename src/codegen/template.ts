import { SourceNode } from 'source-map';
import * as Ast from '../ast/template';
import * as JSAst from '../ast/expression';
import { ENDSyntaxError } from '../parser/syntax-error';
import CompileScope, { RuntimeSymbols as Symbols } from './scope';
import { Chunk, ChunkList, qStr, SourceNodeFactory, sn } from './utils';
import getStats, { collectDynamicStats } from './node-stats';
import compileExpression from './expression';

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

const generators: NodeGeneratorMap = {
    ENDTemplate(node: Ast.ENDTemplate, scope, sn, next) {
        // TODO compile partial
        const chunks: ChunkList = [`export default function ${scope.createSymbol('mount', true)} {\n`];
        const stats = collectDynamicStats(node);

        scope.enterTemplate();

        const ctx = scope.enterElement(`${scope.host}.componentView`, stats);

        chunks.push(scope.indent, ctx, '\n');
        addChunks(node.body, scope, next, chunks);

        if (scope.template.update.length) {
            // Generate function for rendered template update
            // TODO use single function for all components
            chunks.push(scope.indent, `return function ${scope.createSymbol('update', true)}() {\n`);
            scope.level++;
            scope.template.update.forEach(node => {
                chunks.push(scope.indent, node, '\n');
            });
            scope.level--;
            chunks.push(scope.indent, '}\n');
        }

        chunks.push('}\n\n');

        scope.exitElement();
        scope.exitTemplate();

        return sn(node, chunks.filter(Boolean));
    },
    ENDElement(node: Ast.ENDElement, scope, sn, next) {
        const chunks: ChunkList = [];
        const stats = getStats(node);
        const elemName = node.name.name;
        const varName = scope.localSymbol(elemName);
        const elem: SourceNode = stats.text
            ? sn(node.name, `${scope.use(Symbols.elem)}(${elemName}, ${scope.host})`)
            : sn(node.name, [
                `${scope.use(Symbols.elemWithText)}(${elemName},`,
                sn(stats.text, qStr(stats.text.value)),
                `, ${scope.host})`
            ]);

        // Mount element
        if (scope.element.stats.staticContent) {
            chunks.push(sn(node, [`const ${varName} = ${scope.element.symbol}.appendChild(, `, elem, ');']));
        } else {
            chunks.push(sn(node, [`const ${varName} = ${scope.use(Symbols.insert)}(${scope.injector()}, `, elem, ');']));
        }


        // Enter element context
        chunks.push(scope.enterElement(varName, stats));

        // Add attributes
        // TODO handle components
        addChunks(node.attributes, scope, next, chunks);

        // Output content
        addChunks(node.body, scope, next, chunks);

        if (stats.attributeExpressions || stats.dynamicAttributes.size) {
            chunks.push(scope.indent, `${scope.use(Symbols.finalizeAttributes)}(${scope.element.symbol});\n`);
        }

        return sn(node, chunks);
    },
    ENDAttributeStatement(node: Ast.ENDAttributeStatement, scope, sn, next) {
        return sn(node, node.attributes.map(next));
    },
    ENDAttribute(node: Ast.ENDAttribute, scope, sn) {
        const outputName = compileAttributeName(node.name, scope, sn);
        const outputValue = compileAttributeValue(node.value, scope, sn);

        // Dynamic attributes must be handled by runtime and re-rendered on update
        const isDynamic = node.name instanceof JSAst.Program
            || node.value instanceof JSAst.Program
            || node.value instanceof Ast.ENDAttributeValueExpression;

        if (isDynamic) {
            const output = sn(node, [`${scope.use(Symbols.setAttribute)}(${scope.injector()}`, outputName, ', ', outputValue, ');']);
            scope.template.update.push(output);
            return output;
        }

        return sn(node, `${scope.element.symbol}.setAttribute(${outputName}, ${outputValue});`);
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
    ENDEvent(node: Ast.ENDEvent, scope, sn) {
        // Possible event declarations:
        // – on:click="handler"
        // – on:click={emit(1, foo)}
        // – on:click={(evt) => emit(1, foo, evt.pageX)}
        const outputName = compileAttributeName(node.name, scope, sn);

    }
};

function compileAttributeName(name: Ast.ENDAttributeName, scope: CompileScope, sn: SourceNodeFactory): Chunk {
    if (name instanceof JSAst.Identifier) {
        // Static attribute name
        return name.name;
    }

    if (name instanceof JSAst.Program) {
        // Dynamic attribute name
        const fnName = scope.createSymbol('attrName');
        scope.push(sn(name, [`function ${fnName}(${scope.host}) {\n`,
            `${scope.options.indent}return `,
            compileExpression(name, scope),
            `\n}`]));

        return `${fnName}(${scope.host})`;
    }
}

function compileAttributeValue(value: Ast.ENDAttributeValue, scope: CompileScope, sn: SourceNodeFactory): Chunk {
    if (value === null) {
        // Static boolean attribute
        return qStr('');
    }

    if (value instanceof JSAst.Literal) {
        // Static string attribute
        return sn(value, qStr(String(value.value)));
    }

    if (value instanceof JSAst.Program) {
        // Dynamic expression, must be compiled to function
        const fnName = scope.createSymbol('attrValue');
        scope.push(sn(value, [`function ${fnName}(${scope.host}) {\n`,
            `${scope.options.indent}return `,
            compileExpression(value, scope),
            `\n}`]));
        return `${fnName}(${scope.host})`;
    }

    if (value instanceof Ast.ENDAttributeValueExpression) {
        // List of static and dynamic tokens, must be compiled to function
        const fnName = scope.createSymbol('attrValue');
        const chunks: ChunkList = [`function ${fnName}(${scope.host}) {\n${scope.options.indent}return `];

        value.elements.forEach((elem, i) => {
            if (i !== 0) {
                chunks.push(' + ');
            }
            if (elem instanceof JSAst.Program) {
                chunks.push('(', compileExpression(elem, scope), ')');
            } else {
                chunks.push(qStr(String(elem)));
            }
        });
        chunks.push('\n}');

        scope.push(sn(value, chunks));
        return `${fnName}(${scope.host})`;
    }
}

export default function compileTemplate(program: Ast.ENDProgram, scope: CompileScope): SourceNode {
    const compile: Generator = node => {
        if (node.type in generators) {
            return generators[node.type](node, scope, sn, compile);
        }

        throw new ENDSyntaxError(`${node.type} is not supported in templates`,
            node.loc && node.loc.source, node.loc && node.loc.start);
    };

    const chunks: ChunkList = [];
    program.body.forEach(node => {
        if (node instanceof Ast.ENDTemplate) {
            chunks.push(compile(node));
        }
    });

    return sn(program, chunks);
}

/**
 * Adds source node, produced by `fn` function from each `items` into `chunks` array,
 * separated by newline
 */
function addChunks<T extends Ast.ENDNode>(items: T[], scope: CompileScope, fn: Generator, chunks: Chunk[]): void {
    items.forEach(item => {
        const chunk = fn(item);
        if (chunk) {
            chunks.push(scope.indent, chunk, '\n');
        }
    });
}
