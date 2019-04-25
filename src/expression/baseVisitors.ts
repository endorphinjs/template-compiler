import { WalkVisitorMap, getPrefix, commaChunks, WalkContinue } from "./utils";
import {
    Program, Identifier, Literal, ConditionalExpression, ArrayExpression,
    BinaryExpression, LogicalExpression, ExpressionStatement, ObjectExpression,
    Property, RegExpLiteral, SequenceExpression, UnaryExpression, CallExpression,
    EmptyStatement, ThisExpression, MemberExpression, ReturnStatement,
    ArrowFunctionExpression, BlockStatement, ObjectPattern
} from "@endorphinjs/template-parser";
import { sn, propGetter, qStr, isIdentifier } from "../utils";
import { Chunk, ChunkList } from "../types";
import { ENDGetterPrefix, ENDGetter, ENDCaller, ENDFilter } from "./getter";
import { SourceNode } from "source-map";

export default {
    Program(node: Program, state, next) {
        return sn(node.body.map(next), node);
    },
    Identifier(node: Identifier, state) {
        if (node.context === 'store') {
            return sn(state.store(node.name), node, node.raw);
        }

        if (node.context === 'helper') {
            state.helper(node.name);
        }

        const prefix = getPrefix(node.context, state);
        return prefix
            ? sn([prefix, propGetter(node.name)], node, node.raw)
            : sn(node.name, node, node.name);
    },
    Literal(node: Literal) {
        return sn(typeof node.value === 'string' ? qStr(node.value) : String(node.value), node);
    },
    ConditionalExpression(node: ConditionalExpression, state, next) {
        // TODO check if parentheses are required here
        return sn(['(', next(node.test), ' ? ', next(node.consequent), ' : ', next(node.alternate), ')'], node);
    },
    ArrayExpression(node: ArrayExpression, state, next) {
        return sn(commaChunks(node.elements.map(next), '[', ']'), node);
    },
    BinaryExpression(node: BinaryExpression, state, next) {
        // TODO check if parentheses are required here
        return sn(['(', next(node.left), ` ${node.operator} `, next(node.right), ')'], node);
    },
    LogicalExpression(node: LogicalExpression, state, next) {
        // TODO check if parentheses are required here
        return sn(['(', next(node.left), ` ${node.operator} `, next(node.right), ')'], node);
    },
    ExpressionStatement(node: ExpressionStatement, state, next) {
        return next(node.expression);
    },
    ObjectExpression(node: ObjectExpression, state, next) {
        return sn(commaChunks(node.properties.map(prop => property(prop, false, next)), '{ ', ' }'), node);
    },
    ObjectPattern(node: ObjectPattern, state, next) {
        return sn(commaChunks(node.properties.map(prop => property(prop, true, next)), '{ ', ' }'), node);
    },
    Property(node: Property, state, next) {
        return property(node, false, next);
    },
    RegExpLiteral(node: RegExpLiteral) {
        return sn(`${node.regex.pattern}/${node.regex.flags}`, node);
    },
    SequenceExpression(node: SequenceExpression, state, next) {
        return sn(commaChunks(node.expressions.map(next)), node);
    },
    UnaryExpression(node: UnaryExpression, state, next) {
        return sn([node.operator, node.operator.length > 2 ? ' ' : '', next(node.argument)], node);
    },
    MemberExpression(node: MemberExpression, state, next) {
        return isIdentifier(node.property) && !node.property.context
            ? sn([next(node.object), '.', next(node.property)])
            : sn([next(node.object), '[', next(node.property), ']']);
    },
    CallExpression(node: CallExpression, state, next) {
        return sn([next(node.callee), ...commaChunks(node.arguments.map(next), '(', ')')]);
    },
    EmptyStatement(node: EmptyStatement) {
        return sn('', node);
    },
    ThisExpression(node: ThisExpression, state) {
        return sn(state.host, node);
    },
    ArrowFunctionExpression(node: ArrowFunctionExpression, state, next) {
        const params = node.params.length === 1 && isIdentifier(node.params[0])
            ? next(node.params[0])
            : sn(commaChunks(node.params.map(next), '(', ')'))
        return sn([params, ' => ', next(node.body)]);
    },
    BlockStatement(node: BlockStatement, state, next) {
        return sn(['{', ...node.body.map(next), '}']);
    },
    ReturnStatement(node: ReturnStatement, state, next) {
        return node.argument
            ? sn(['return ', next(node.argument)], node)
            : sn('return', node);
    },

    // Endorphin addons
    ENDGetterPrefix(node: ENDGetterPrefix, state) {
        return sn(getPrefix(node.context, state));
    },

    ENDGetter(node: ENDGetter, state, next) {
        const chunks = node.path.map(fragment =>
            isIdentifier(fragment) && !fragment.context
                ? qStr(fragment.name)
                : next(fragment)
        );
        return sn([state.runtime('get'), ...commaChunks(chunks, '(', ')')]);
    },

    ENDCaller(node: ENDCaller, state, next) {
        const chunks: ChunkList = [
            next(node.object),
            isIdentifier(node.property) && !node.property.context
                ? qStr(node.property.name)
                : next(node.property)
        ];

        if (node.arguments && node.arguments.length) {
            chunks.push(sn(commaChunks(node.arguments.map(next), '[', ']')));
        }

        return sn([state.runtime('call'), ...commaChunks(chunks, '(', ')')]);
    },

    ENDFilter(node: ENDFilter, state, next) {
        return sn([state.runtime(node.multiple ? 'filterAll' : 'filter'), '(', next(node.object), ', ', next(node.expression), ')']);
    }
} as WalkVisitorMap;

function property(node: Property, isPattern: boolean, next: WalkContinue): SourceNode {
    const key: Chunk = isIdentifier(node.key) ? node.key.name : next(node.key);

    if (node.computed) {
        return sn(['[', key, ']: ', next(node.value)], node);
    }

    if (node.shorthand) {
        return isPattern
            ? sn(key, node)
            : sn([key, ': ', next(node.value)], node);
    }

    return sn([key, ': ', next(node.value)], node);
}
