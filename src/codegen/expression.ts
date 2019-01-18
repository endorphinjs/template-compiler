import { SourceNode } from 'source-map';
import * as Ast from '../ast/expression';
import CompileScope, { RuntimeSymbols as Symbols } from './scope';
import { ENDSyntaxError } from '../parser/syntax-error';
import { Chunk, ChunkList, qStr } from './utils';

/**
 * SourceNode factory which attaches location info to source map node from given
 * AST node
 */
interface SourceNodeFactory {
    (node: Ast.JSNode, chunks?: ChunkList | Chunk, name?: string): SourceNode
}

/**
 * Code generator continuation function
 */
interface Generator {
    (node: Ast.JSNode): SourceNode
}

/**
 * Code generator for AST node of specific type
 */
interface NodeGenerator<T extends Ast.JSNode> {
    (node: T, scope: CompileScope, sn: SourceNodeFactory, next: Generator): SourceNode;
}

export interface NodeGeneratorMap {
    [type: string]: NodeGenerator<Ast.JSNode>
}

const generators: NodeGeneratorMap = {
    // Basic JS nodes
    Program(node: Ast.Program, scope, sn, next) {
        return sn(node, node.body.map(next));
    },
    Identifier(node: Ast.Identifier, scope, sn) {
        return sn(node, node.name);
    },
    Literal(node: Ast.Literal, scope, sn) {
        return sn(node, typeof node.value === 'string'
            ? qStr(node.value) : String(node.value));
    },
    ConditionalExpression(node: Ast.ConditionalExpression, scope, sn, next) {
        // TODO check if parentheses are required here
        return sn(node, ['(', next(node.test), ' ? ', next(node.consequent), ' : ', next(node.alternate), ')']);
    },
    ArrayExpression(node: Ast.ArrayExpression, scope, sn, next) {
        return sn(node, commaChunks(node.elements.map(next), '[', ']'));
    },
    BinaryExpression(node: Ast.BinaryExpression, scope, sn, next) {
        // TODO check if parentheses are required here
        return sn(node, ['(', next(node.left), ` ${node.operator} `, next(node.right), ')']);
    },
    LogicalExpression(node: Ast.LogicalExpression, scope, sn, next) {
        // TODO check if parentheses are required here
        return sn(node, ['(', next(node.left), ` ${node.operator} `, next(node.right), ')']);
    },
    ExpressionStatement(node: Ast.ExpressionStatement, scope, sn, next) {
        return next(node.expression);
    },
    ObjectExpression(node: Ast.ObjectExpression, scope, sn, next) {
        return sn(node, commaChunks(node.properties.map(next), '{', '}'));
    },
    Property(node: Ast.Property, scope, sn, next) {
        if (node.key instanceof Ast.Identifier && node.value instanceof Ast.Identifier && node.key.name === node.value.name) {
            // Shorthand property
            return sn(node.key, next(node.key));
        }

        return sn(node, [next(node.key), ': ', next(node.value)]);
    },
    RegExpLiteral(node: Ast.RegExpLiteral, scope, sn) {
        return sn(node, `${node.regex.pattern}/${node.regex.flags}`);
    },
    SequenceExpression(node: Ast.SequenceExpression, scope, sn, next) {
        return sn(node, commaChunks(node.expressions.map(next)));
    },
    UnaryExpression(node: Ast.UnaryExpression, scope, sn, next) {
        return sn(node, [node.operator, node.operator.length > 2 ? ' ' : '', next(node.argument)]);
    },
    ArrowFunctionExpression(node: Ast.ArrowFunctionExpression) {
        throw new Error(`Not implemented ${node.type}`);
    },
    CallExpression(node: Ast.CallExpression) {
        throw new Error(`Not implemented ${node.type}`);
    },
    EmptyStatement(node: Ast.EmptyStatement) {
        return sn(node, '');
    },

    // Endorphin addons
    ENDGetter(node: Ast.ENDGetter, scope, sn, next) {
        if (!node.path.length) {
            return next(node.root);
        }

        const chunks: ChunkList = [scope.use(Symbols.get), '(', next(node.root)];
        node.path.forEach(node => chunks.push(', ', next(node)));
        chunks.push(')');

        return sn(node, chunks);
    },
    ENDPropertyIdentifier(node: Ast.ENDPropertyIdentifier, scope, sn) {
        return sn(node, `${scope.host}.props${propAccessor(node.name)}`, node.raw);
    },
    ENDStateIdentifier(node: Ast.ENDStateIdentifier, scope, sn) {
        return sn(node, `${scope.host}.state${propAccessor(node.name)}`, node.raw);
    },
    ENDVariableIdentifier(node: Ast.ENDVariableIdentifier, scope, sn) {
        return sn(node, `${scope.use(Symbols.getVar)}(${scope.host}, ${qStr(node.name)})`, node.raw);
    },
    ENDFilter(node: Ast.ENDFilter, scope, sn, next) {
        const params = node.filter.params.slice();

        // Add host component as first argument of function
        // TODO handle cases where `host` is already defined as function argument
        params.unshift(new Ast.Identifier(scope.host));

        // Generate function declaration for given filter
        const fnName = scope.createSymbol('filter');
        const fn = commaChunks(params.map(next), `function ${fnName}(`, ') ');

        fn.push('{\n\treturn ', next(node.filter.body), `;\n}`);

        // Add generated function to output
        scope.push(sn(node.filter, fn));

        // Return expression that uses generated filter
        return sn(node, [scope.use(Symbols.filter), '(',
            scope.host, ', ',
            next(node.object), ', ',
            fnName,
        ')']);
    }
};

export default function compileExpression(program: Ast.Program, scope: CompileScope, override?: NodeGeneratorMap): SourceNode {
    return generate(program, scope, override);
}

export function generate(node: Ast.JSNode, scope: CompileScope, override?: NodeGeneratorMap): SourceNode {
    const localGenerators = { ...generators, ...override };

    const next: Generator = node => {
        if (node.type in localGenerators) {
            return localGenerators[node.type](node, scope, sn, next);
        }

        throw new ENDSyntaxError(`${node.type} is not supported in getter expressions`,
            node.loc && node.loc.source, node.loc && node.loc.start);
    }

    return next(node);
}

const sn: SourceNodeFactory = (node, chunks, name) => {
    if (node.loc) {
        return new SourceNode(node.loc.start.line, node.loc.start.column, node.loc.source, chunks, name);
    }

    const output = new SourceNode();
    output.add(chunks);
    return output;
}

/**
 * Generates property accessor code
 */
function propAccessor(name: string): string {
    return /^[a-zA-Z_$][\w_$]*$/.test(name)
        ? `.${name}` : `[${qStr(name)}]`;
}

/**
 * Generates comma-separated list of given chunks with optional `before` and `after`
 * wrapper code
 */
function commaChunks<T extends Chunk>(items: T[], before?: string, after?: string): ChunkList {
    const chunks: ChunkList = [];

    before != null && chunks.push(before);
    items.forEach((node, i) => {
        if (i !== 0) {
            chunks.push(', ');
        }
        chunks.push(node);
    });
    after != null && chunks.push(after);

    return chunks;
}
