import * as Ast from '@endorphinjs/template-parser';
import { SourceNode } from 'source-map';
import { BuilderContext } from "./BuilderContext";
import { Chunk, ChunkList, sn, propGetter, qStr } from './utils';
import { ENDCompileError } from './error';

type AstContinue = (node: Ast.Node) => SourceNode;
type AstVisitor = (node: Ast.Node, ctx: BuilderContext, next: AstContinue) => SourceNode;
type AstVisitorMap = { [name: string]: AstVisitor };

export default function generateExpression(expr: Ast.Program, ctx: BuilderContext, visitors: AstVisitorMap = {}): SourceNode {
    return walk(expr, ctx, { ...baseVisitors, ...visitors });
}

const baseVisitors = {
    Program(node: Ast.Program, ctx, next) {
        return sn(node.body.map(next), node);
    },
    Identifier(node: Ast.Identifier, ctx) {
        if (node.context === 'store') {
            return sn(ctx.store(node.name), node, node.raw);
        }

        const prefix = getPrefix(node, ctx);
        return prefix
            ? sn([prefix, propGetter(node.name)], node, node.raw)
            : sn(node.name, node, node.name);
    },
    Literal(node: Ast.Literal) {
        return sn(typeof node.value === 'string' ? qStr(node.value) : String(node.value), node);
    },
    ConditionalExpression(node: Ast.ConditionalExpression, ctx, next) {
        // TODO check if parentheses are required here
        return sn(['(', next(node.test), ' ? ', next(node.consequent), ' : ', next(node.alternate), ')'], node);
    },
    ArrayExpression(node: Ast.ArrayExpression, ctx, next) {
        return sn(commaChunks(node.elements.map(next), '[', ']'), node);
    },
    BinaryExpression(node: Ast.BinaryExpression, scope, next) {
        // TODO check if parentheses are required here
        return sn(['(', next(node.left), ` ${node.operator} `, next(node.right), ')'], node);
    },
    LogicalExpression(node: Ast.LogicalExpression, scope, next) {
        // TODO check if parentheses are required here
        return sn(['(', next(node.left), ` ${node.operator} `, next(node.right), ')'], node);
    },
    ExpressionStatement(node: Ast.ExpressionStatement, ctx, next) {
        return next(node.expression);
    },
    ObjectExpression(node: Ast.ObjectExpression, ctx, next) {
        return sn(commaChunks(node.properties.map(next), '{', '}'), node);
    },
    Property(node: Ast.Property, ctx, next) {
        const key: Chunk = node.key.type === 'Identifier'
            ? node.key.name
            : next(node.key);

        if (node.computed) {
            return sn(['[', key, ']: ', next(node.value)], node);
        }

        if (node.shorthand) {
            return sn([key, ': ', next(node.value)], node);
        }

        return sn([key, ': ', next(node.value)], node);
    },
    RegExpLiteral(node: Ast.RegExpLiteral) {
        return sn(`${node.regex.pattern}/${node.regex.flags}`, node);
    },
    SequenceExpression(node: Ast.SequenceExpression, ctx, next) {
        return sn(commaChunks(node.expressions.map(next)), node);
    },
    UnaryExpression(node: Ast.UnaryExpression, ctx, next) {
        return sn([node.operator, node.operator.length > 2 ? ' ' : '', next(node.argument)], node);
    },
    CallExpression(node: Ast.CallExpression, ctx, next) {
        const args: ChunkList = node.arguments.map(next);
        const { callee } = node;

        if (callee.type === 'Identifier') {
            if (callee.context === 'helper') {
                // Calling helper method
                // The first argument in helper is always a host component
                // TODO handle deep requests like `helper.bar()`
                args.unshift(ctx.host());
                return sn(commaChunks(args, `${ctx.state.useHelper(callee.name)}(`, ')'), node);
            }

            if (callee.context === 'store') {
                const chunks: ChunkList = commaChunks(args, '(', ')');
                chunks.unshift(next(callee));
                return sn(chunks, node);
            }

            if (callee.context === 'property' || callee.context === 'state' || callee.context === 'variable') {
                return sn([
                    `${ctx.state.runtime('call')}(`,
                    getPrefix(callee, ctx), ', ',
                    qStr(callee.name),
                    sn(args.length ? commaChunks(args, ', [', ']') : ''),
                    ')'
                ], node);
            }
        }

        // TODO implement
        // const argsNodes = sn(args.length ? commaChunks(args, ', [', ']') : '');
        // if (callee instanceof Ast.ENDGetter) {
        //     const getterPath = Array.from(callee.path);
        //     const methodName = getterPath.pop();
        //     const parentGetter = new Ast.ENDGetter(callee.root, getterPath);
        //     parentGetter.loc = callee.loc;

        //     const chunks: ChunkList = [next(parentGetter), ', ', next(methodName), argsNodes];
        //     return sn(node, [`${ctx.use(Symbols.call)}(`, wrapSN(chunks), ')']);
        // }

        throw new ENDCompileError(`Unexpected token ${callee.type} for function call`, node);
    },
    EmptyStatement(node: Ast.EmptyStatement) {
        return sn('', node);
    },
    ThisExpression(node: Ast.ThisExpression, scope) {
        return sn(scope.host(), node);
    }
} as AstVisitorMap;

function walk(node: Ast.Node, ctx: BuilderContext, visitors: AstVisitorMap): SourceNode {
    const next: AstContinue = node => {
        if (node.type in visitors) {
            return visitors[node.type](node, ctx, next);
        }

        throw new ENDCompileError(`${node.type} is not supported in getter expressions`, node);
    }

    return next(node);
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

/**
 * Returns accessor prefix from host component for given token
 */
function getPrefix(node: Ast.Identifier, ctx: BuilderContext): string {
    if (node.context === 'property') {
        return `${ctx.host()}.props`;
    }

    if (node.context === 'state') {
        return `${ctx.host()}.state`;
    }

    if (node.context === 'variable') {
        return ctx.scope();
    }

    return '';
}
