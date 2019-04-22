import * as Ast from '@endorphinjs/template-parser';
import { SourceNode } from 'source-map';
import { sn, propGetter, qStr } from './utils';
import { ENDCompileError } from './error';
import CompileState from './assets/CompileState';
import { Chunk, ChunkList } from './types';

type AstContinue = (node: Ast.Node) => SourceNode;
type AstVisitor = (node: Ast.Node, state: CompileState, next: AstContinue) => SourceNode;
type AstVisitorMap = { [name: string]: AstVisitor };

export default function generateExpression(expr: Ast.Program, state: CompileState, visitors: AstVisitorMap = {}): SourceNode {
    return walk(expr, state, { ...baseVisitors, ...visitors });
}

const baseVisitors = {
    Program(node: Ast.Program, state, next) {
        return sn(node.body.map(next), node);
    },
    Identifier(node: Ast.Identifier, state) {
        if (node.context === 'store') {
            return sn(state.store(node.name), node, node.raw);
        }

        const prefix = getPrefix(node, state);
        return prefix
            ? sn([prefix, propGetter(node.name)], node, node.raw)
            : sn(node.name, node, node.name);
    },
    Literal(node: Ast.Literal) {
        return sn(typeof node.value === 'string' ? qStr(node.value) : String(node.value), node);
    },
    ConditionalExpression(node: Ast.ConditionalExpression, state, next) {
        // TODO check if parentheses are required here
        return sn(['(', next(node.test), ' ? ', next(node.consequent), ' : ', next(node.alternate), ')'], node);
    },
    ArrayExpression(node: Ast.ArrayExpression, state, next) {
        return sn(commaChunks(node.elements.map(next), '[', ']'), node);
    },
    BinaryExpression(node: Ast.BinaryExpression, state, next) {
        // TODO check if parentheses are required here
        return sn(['(', next(node.left), ` ${node.operator} `, next(node.right), ')'], node);
    },
    LogicalExpression(node: Ast.LogicalExpression, state, next) {
        // TODO check if parentheses are required here
        return sn(['(', next(node.left), ` ${node.operator} `, next(node.right), ')'], node);
    },
    ExpressionStatement(node: Ast.ExpressionStatement, state, next) {
        return next(node.expression);
    },
    ObjectExpression(node: Ast.ObjectExpression, state, next) {
        return sn(commaChunks(node.properties.map(next), '{', '}'), node);
    },
    Property(node: Ast.Property, state, next) {
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
    SequenceExpression(node: Ast.SequenceExpression, state, next) {
        return sn(commaChunks(node.expressions.map(next)), node);
    },
    UnaryExpression(node: Ast.UnaryExpression, state, next) {
        return sn([node.operator, node.operator.length > 2 ? ' ' : '', next(node.argument)], node);
    },
    CallExpression(node: Ast.CallExpression, state, next) {
        const args: ChunkList = node.arguments.map(next);
        const { callee } = node;

        if (callee.type === 'Identifier') {
            if (callee.context === 'helper') {
                // Calling helper method
                // The first argument in helper is always a host component
                // TODO handle deep requests like `helper.bar()`
                args.unshift(state.host);
                return sn(commaChunks(args, `${state.helper(callee.name)}(`, ')'), node);
            }

            if (callee.context === 'store') {
                const chunks: ChunkList = commaChunks(args, '(', ')');
                chunks.unshift(next(callee));
                return sn(chunks, node);
            }

            if (callee.context === 'property' || callee.context === 'state' || callee.context === 'variable') {
                return sn([
                    `${state.runtime('call')}(`,
                    getPrefix(callee, state), ', ',
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
    ThisExpression(node: Ast.ThisExpression, state) {
        return sn(state.host, node);
    }
} as AstVisitorMap;

function walk(node: Ast.Node, state: CompileState, visitors: AstVisitorMap): SourceNode {
    const next: AstContinue = node => {
        if (node.type in visitors) {
            return visitors[node.type](node, state, next);
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
function getPrefix(node: Ast.Identifier, state: CompileState): string {
    if (node.context === 'property') {
        return `${state.host}.props`;
    }

    if (node.context === 'state') {
        return `${state.host}.state`;
    }

    if (node.context === 'variable') {
        return state.scope;
    }

    return '';
}
