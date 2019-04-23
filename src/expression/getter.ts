import { Node, MemberExpression, ArgumentListElement, Expression, CallExpression } from "@endorphinjs/template-parser";
import { isIdentifier } from "../utils";

type GetterPathFragment = Expression | ENDGetter | ENDCaller;
type GetterPath = GetterPathFragment[];

export interface ENDGetterPrefix extends Node {
    type: 'ENDGetterPrefix';
    context: string;
}

export interface ENDGetter extends Node {
    type: 'ENDGetter';
    path: GetterPath;
}

export interface ENDCaller extends Node {
    type: 'ENDCaller';
    object: GetterPathFragment | ENDGetterPrefix;
    property: GetterPathFragment | ENDGetterPrefix;
    arguments: ArgumentListElement[];
}

/**
 * Collects plain path for value getter, if possible
 */
export function createGetter(expr: MemberExpression): ENDGetter | MemberExpression {
    const result: ENDGetter = {
        type: 'ENDGetter',
        path: []
    };

    let ctx: Expression = expr;
    while (ctx) {
        if (isMemberExpression(ctx)) {
            result.path.unshift(convert(ctx.property));
            ctx = ctx.object;
        } else {
            if (isIdentifier(ctx) && !ctx.context) {
                // Accessing global object, no need to rewrite
                return expr;
            }
            result.path.unshift(convert(ctx));
            ctx = null;
        }
    }

    return result;
}

export function createCaller(expr: CallExpression): ENDCaller | CallExpression {
    const { callee } = expr;
    if (isIdentifier(callee) && callee.context) {
        // Fast path: calling top-level function, which is likely to be state
        // or prop. Decompose identifier into prefix and name
        if (callee.context === 'helper') {
            // Calling helper: keep function as is but add current component
            // as first argument
            return {
                ...expr,
                arguments: [{ type: 'ThisExpression' }, ...expr.arguments]
            };
        }

        if (callee.context !== 'store') {
            return {
                type: 'ENDCaller',
                object: getterPrefix(callee.context),
                property: { ...callee, context: null },
                arguments: expr.arguments
            };
        }
    }

    if (isMemberExpression(callee)) {
        if (isIdentifier(callee.object) && !callee.object.context) {
            // Fast path: calling known global property method like `Math.round()`
            return expr;
        }

        return {
            type: 'ENDCaller',
            object: convert(callee.object),
            property: callee.property,
            arguments: expr.arguments
        };
    }

    return expr;
}

export function convert(node: Expression): Expression | ENDCaller | ENDGetter {
    if (isMemberExpression(node)) {
        return createGetter(node);
    }

    if (isCallExpression(node)) {
        return createCaller(node);
    }

    return node;
}

function isMemberExpression(node: Node): node is MemberExpression {
    return node.type === 'MemberExpression';
}

function isCallExpression(node: Node): node is CallExpression {
    return node.type === 'CallExpression';
}

function getterPrefix(context: string): ENDGetterPrefix {
    return { type: 'ENDGetterPrefix', context };
}
