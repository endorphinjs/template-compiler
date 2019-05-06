import { Program, JSNode, Node } from "@endorphinjs/template-parser";
import CompileState from "./lib/CompileState";
import baseVisitors from "./visitors/expression";
import { entity } from "./entities/Entity";
import { sn } from "./lib/utils";
import { ENDCompileError } from "./lib/error";
import { ExpressionContinue, ExpressionVisitorMap, ExpressionOutput } from "./types";

export default function generateExpression(expr: JSNode, state: CompileState, visitors: ExpressionVisitorMap = {}): ExpressionOutput {
    return walk(expr, state, { ...baseVisitors, ...visitors });
}

/**
 * Generates function from given JS code in compile state
 * @param prefix
 * @param state
 * @param value
 */
export function fn(prefix: string, state: CompileState, value: Program): string {
    return state.runBlock(prefix, () =>
        entity('block', state, {
            mount: () => sn(['return ', generateExpression(value, state)])
        }));
}

export function walk(node: Node, state: CompileState, visitors: ExpressionVisitorMap): ExpressionOutput {
    const next: ExpressionContinue = node => {
        if (node.type in visitors) {
            return visitors[node.type](node, state, next);
        }

        throw new ENDCompileError(`${node.type} is not supported in template expressions`, node);
    }

    return next(node);
}

/**
 * Returns accessor prefix from host component for given token
 */
export function getPrefix(context: string, state: CompileState): string {
    if (context === 'property') {
        return `${state.host}.props`;
    }

    if (context === 'state') {
        return `${state.host}.state`;
    }

    if (context === 'variable') {
        return state.scope;
    }

    if (context === 'store') {
        return `${state.host}.store.data`;
    }

    if (context === 'definition') {
        return `${state.host}.componentModel.definition`;
    }

    return '';
}
