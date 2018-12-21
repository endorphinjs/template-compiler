import { SourceNode } from 'source-map';
import * as Ast from '../ast/expression';
import CompileScope, { RuntimeSymbols as Symbols } from './scope';
import { ENDSyntaxError } from '../parser/syntax-error';

interface Result {
    code: SourceNode;
    symbols: Symbols[]
}

type Chunk = string | SourceNode;
type ChunkList = Array<Chunk>;

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
    (node: Ast.JSNode, scope: CompileScope): SourceNode
}

/**
 * Code generator for AST node of specific type
 */
interface NodeGenerator<T extends Ast.JSNode> {
    (node: T, scope: CompileScope, sn: SourceNodeFactory, next: Generator): SourceNode;
}

interface NodeGeneratorMap {
    [type: string]: NodeGenerator<Ast.JSNode>
}

const generators: NodeGeneratorMap = {
    // Basic JS nodes
    Literal(node: Ast.Literal, scope, sn) {
        return sn(node, typeof node.value === 'string'
            ? qStr(node.value) : String(node.value));
    },
    ConditionalExpression(node: Ast.ConditionalExpression, scope, sn, next) {
        // TODO check if parentheses are required here
        return sn(node, ['(', next(node.test, scope), ' ? ', next(node.consequent, scope), ' : ', next(node.alternate, scope), ')']);
    },
    ArrayExpression(node: Ast.ArrayExpression, scope, sn, next) {
        return sn(node, commaChunks(node.elements, '[', ']',
            (item, chunks) => chunks.push(next(item, scope))));
    },
    BinaryExpression(node: Ast.BinaryExpression, scope, sn, next) {
        // TODO check if parentheses are required here
        return sn(node, ['(', next(node.left, scope), ` ${node.operator} `, next(node.right, scope), ')']);
    },
    LogicalExpression(node: Ast.LogicalExpression, scope, sn, next) {
        // TODO check if parentheses are required here
        return sn(node, ['(', next(node.left, scope), ` ${node.operator} `, next(node.right, scope), ')']);
    },
    ExpressionStatement(node: Ast.ExpressionStatement, scope, sn, next) {
        return next(node.expression, scope);
    },
    ObjectExpression(node: Ast.ObjectExpression, scope, sn, next) {
        return sn(node, commaChunks(node.properties, '{', '}',
            (prop, chunks) => chunks.push(
                sn(prop.key, prop.key instanceof Ast.Literal ? prop.key.raw : prop.key.name),
                ': ',
                next(prop, scope)
            )));
    },
    RegExpLiteral(node: Ast.RegExpLiteral, scope, sn) {
        return sn(node, `${node.regex.pattern}/${node.regex.flags}`);
    },
    SequenceExpression(node: Ast.SequenceExpression, scope, sn, next) {
        return sn(node, commaChunks(node.expressions, '', '',
            (item, chunks) => chunks.push(next(item, scope))));
    },
    UnaryExpression(node: Ast.UnaryExpression, scope, sn, next) {
        return sn(node, [node.operator, node.operator.length > 2 ? ' ' : '', next(node.argument, scope)]);
    },
    ArrowFunctionExpression(node: Ast.ArrowFunctionExpression) {
        throw new Error(`Not implemented ${node.type}`);
    },
    CallExpression(node: Ast.CallExpression) {
        throw new Error(`Not implemented ${node.type}`);
    },

    // Endorphin addons
    ENDGetter(node: Ast.ENDGetter, scope, sn, next) {
        if (!node.path.length) {
            return next(node.root, scope);
        }

        const chunks: ChunkList = [scope.use(Symbols.get), '(', next(node.root, scope)];
        node.path.forEach(node => chunks.push(', ', next(node, scope)));
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
        params.unshift(new Ast.Identifier(scope.host));

        return sn(node, [scope.use(Symbols.filter), '(',
            scope.host, ', ',
            next(node.object, scope), ', ',
            sn(node.filter, scope.registerFunction('filter', params, node.filter.body)),
        ')']);
    }
};

export function expression(program: Ast.Program): Result {
    const expressions: Ast.Statement[] = program.body.filter(expr => expr.type !== 'EmptyStatement');

    if (expressions.length > 1) {
        throw new ENDSyntaxError(`The "${program.raw}" expression must contain single statement, ${program.raw.length} given`,
            program.loc.source, program.loc.start);
    }

    const scope = new CompileScope();
    return {
        code: expressions.length ? getExpression(expressions[0], scope) : sn(program, 'null'),
        symbols: Array.from(scope.symbols)
    };
}

/**
 * Returns expression getter
 */
const getExpression: Generator = (node, scope) => {
    if (node.type in generators) {
        return generators[node.type](node, scope, sn, getExpression);
    }

    throw new ENDSyntaxError(`${node.type} is not supported in getter expressions`,
        node.loc.source, node.loc.start);
};

const sn: SourceNodeFactory = (node, chunks, name) =>
    new SourceNode(node.loc.start.line, node.loc.start.column, node.loc.source, chunks, name);

/**
 * Generates property accessor code
 */
function propAccessor(name: string): string {
    return /^[a-zA-Z_$][\w_$]*$/.test(name)
        ? `.${name}` : `[${qStr(name)}]`;
}

/**
 * Returns quoted string
 */
function qStr(text: string): string {
    return `'${text.replace(/'/g, '\\\'')}'`;
}

/**
 * Generates comma-separated list of given chunks with optional `before` and `after`
 * wrapper code
 */
function commaChunks<T extends Ast.JSNode>(items: T[], before: string, after: string, fn: (node: T, chunks: ChunkList) => void): ChunkList {
    const chunks: ChunkList = [];

    before && chunks.push(before);
    items.forEach((node, i) => {
        if (i !== 0) {
            chunks.push(', ');
        }
        fn(node, chunks);
    });
    after && chunks.push(after);

    return chunks;
}
