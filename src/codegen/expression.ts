import { SourceNode } from 'source-map';
import { Node } from '../ast/base';
import * as Ast from '../ast/expression';
import CompileScope, { RuntimeSymbols as Symbols } from './scope';
import { ENDSyntaxError } from '../parser/syntax-error';

interface Result {
    code: SourceNode;
    symbols: Symbols[]
}

type ChunkList = Array <string | SourceNode>;

const safeProp = /^[a-zA-Z]\w*$/;

export function expression(program: Ast.Program): Result {
    const expressions: Ast.Statement[] = program.body.filter(expr => expr instanceof Ast.ExpressionStatement);

    if (expressions.length > 1) {
        throw new ENDSyntaxError(`The "${program.raw}" expression must contain single statement, ${program.raw.length} given`,
            program.loc.source, program.loc.start);
    }

    let code: SourceNode;
    const scope = new CompileScope();
    if (!expressions.length) {
        code = sn(program, 'null');
    } else {
        code = getExpression(expressions[0], scope);
    }

    return { code, symbols: Array.from(scope.symbols) };
}

/**
 * Returns expression getter
 */
function getExpression(expr: Ast.JSNode, scope: CompileScope): SourceNode {
    if (expr instanceof Ast.ArrayExpression) {
        return sn(expr, commaChunks(expr.elements, '[', ']',
            (item, chunks) => chunks.push(getExpression(item, scope))));
    }

    if (expr instanceof Ast.BinaryExpression || expr instanceof Ast.LogicalExpression) {
        // TODO check if parentheses are required here
        return sn(expr, ['(', getExpression(expr.left, scope), ` ${expr.operator} `, getExpression(expr.right, scope), ')']);
    }

    if (expr instanceof Ast.MemberExpression) {
        return memberGetter(expr, scope);
    }

    if (expr instanceof Ast.ConditionalExpression) {
        // TODO check if parentheses are required here
        return sn(expr, ['(', getExpression(expr.test, scope), ' ? ', getExpression(expr.consequent, scope), ' : ', getExpression(expr.alternate, scope), ')']);
    }

    if (expr instanceof Ast.Identifier) {
        return getIdentifier(expr, scope);
    }

    if (expr instanceof Ast.Literal) {
        return sn(expr, expr.raw);
    }

    if (expr instanceof Ast.ObjectExpression) {
        return sn(expr, commaChunks(expr.properties, '{', '}',
            (prop, chunks) => chunks.push(
                sn(prop.key, prop.key instanceof Ast.Literal ? prop.key.raw : prop.key.name),
                ': ',
                getExpression(prop, scope)
            )));
    }

    if (expr instanceof Ast.RegExpLiteral) {
        return sn(expr, `${expr.regex.pattern}/${expr.regex.flags}`);
    }

    if (expr instanceof Ast.SequenceExpression) {
        return sn(expr, commaChunks(expr.expressions, '', '',
            (item, chunks) => chunks.push(getExpression(item, scope))));
    }

    if (expr instanceof Ast.UnaryExpression) {
        return sn(expr, [expr.operator, expr.operator.length > 2 ? ' ' : '', getExpression(expr.argument, scope)]);
    }

    if (expr instanceof Ast.ArrowFunctionExpression) {
        throw new Error(`Not implemented ${expr.type}`);
    }

    if (expr instanceof Ast.CallExpression) {
        throw new Error(`Not implemented ${expr.type}`);
    }

    throw new ENDSyntaxError(`${expr.type} is not supported in getter expressions`,
        expr.loc.source, expr.loc.start);
}

/**
 * Returns deep getter for given expression
 */
function memberGetter(expr: Ast.MemberExpression, scope: CompileScope): SourceNode {
    // Collect getter path
    const path: SourceNode[] = [];
    let root: SourceNode;
    let ctx = expr;

    while (ctx) {
        if (ctx.property instanceof Ast.Identifier) {
            path.unshift(ctx.computed
                ? getIdentifier(ctx.property, scope)
                : sn(ctx.property, qStr(ctx.property), ctx.property.name));
        } else if (ctx.property instanceof Ast.ArrowFunctionExpression) {
            throw new Error(`Filters not implemented`);
        } else {
            path.unshift(getExpression(ctx.property, scope));
        }

        if (ctx.object instanceof Ast.MemberExpression) {
            ctx = ctx.object;
        } else {
            if (ctx.object instanceof Ast.Identifier) {
                root = getIdentifier(ctx.object, scope);
            }
            break;
        }
    }

    if (!root) {
        throw new ENDSyntaxError(`Unexpected "${expr.object.type}" in object expression`,
            expr.object.loc.source, expr.object.loc.start);
    }

    const chunks: ChunkList = [scope.use(Symbols.get), '(', root];
    path.forEach((node, i) => {
        if (i === 0) {
            chunks.push(', ');
        }
        chunks.push(node);
    });
    chunks.push(')');

    return sn(expr, chunks);
}

/**
 * Generates getter for given identifier
 */
function getIdentifier(node: Ast.Identifier, scope: CompileScope): SourceNode {
    if (node.name.startsWith('#')) {
        // Local state access
        return sn(node, `${scope.host}.state${propAccessor(node.name.slice(1))}`, node.name);
    }

    if (node.name.startsWith('$')) {
        // Runtime template variable
        return sn(node, `${scope.use(Symbols.getVar)}(${qStr(node.name.slice(1))})`, node.name);
    }

    if (node.name.startsWith('@')) {
        // Model property access
        throw new Error('Not implemented');
    }

    // By default, assume we’re accessing component prop
    return sn(node, `${scope.host}.props${propAccessor(node.name)}`, node.name);
}

function sn(node: Node, chunks?: Array<(string | SourceNode)> | SourceNode | string, name?: string): SourceNode {
    return new SourceNode(node.loc.start.line, node.loc.start.column, node.loc.source, chunks, name);
}

/**
 * Generates property accessor code
 */
function propAccessor(name: string): string {
    return safeProp.test(name) ? `.${name}` : `[${qStr(name)}]`;
}

/**
 * Returns quoted string
 */
function qStr(text): string {
    return `'${text.replace(/'/g, '\\\'')}'`;
}

function commaChunks<T extends Ast.JSNode>(items: T[], before: string, after: string, fn: (node: T, chunks: ChunkList) => void): ChunkList {
    const chunks: ChunkList = [];

    before && chunks.push(before);
    items.forEach((node, i) => {
        if (i === 0) {
            chunks.push(', ');
        }
        fn(node, chunks);
    });
    after && chunks.push(after);

    return chunks;
}
