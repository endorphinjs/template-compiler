import { MemberExpression, ArgumentListElement, Expression, CallExpression, ArrowFunctionExpression, ArrayExpression, JSNode } from "@endorphinjs/template-parser";
import { isIdentifier } from "../utils";

type GetterPathFragment = Expression | ENDGetter | ENDCaller | ENDFilter;
type GetterPath = GetterPathFragment[];

export interface ENDGetterPrefix extends JSNode {
    type: 'ENDGetterPrefix';
    context: string;
}

export interface ENDGetter extends JSNode {
    type: 'ENDGetter';
    path: GetterPath;
}

export interface ENDCaller extends JSNode {
    type: 'ENDCaller';
    object: GetterPathFragment | ENDGetterPrefix;
    property: GetterPathFragment | ENDGetterPrefix;
    arguments: ArgumentListElement[];
}

export interface ENDFilter extends JSNode {
    type: 'ENDFilter';
    object: GetterPathFragment;
    expression: ArrowFunctionExpression;
    multiple: boolean;
}

export function convert(node: Expression): GetterPathFragment {
    if (isMemberExpression(node)) {
        return isFilter(node)
            ? createFilter(node)
            : createGetter(node);
    }

    if (isCallExpression(node)) {
        return createCaller(node);
    }

    return node;
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
            if (isFilter(ctx)) {
                result.path.unshift(createFilter(ctx));
                break;
            }

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

function createFilter(expr: MemberExpression): ENDFilter {
    const { property, object } = expr;
    const filter = (isArray(property) ? property.elements[0] : property) as ArrowFunctionExpression;

    return {
        type: 'ENDFilter',
        object: convert(object),
        expression: filter,
        multiple: isArray(property)
    }
}

function isFilter(expr: MemberExpression): boolean {
    return isFunction(expr.property)
        || isArray(expr.property) && expr.property.elements.length
            && isFunction(expr.property.elements[0]);
}

function isMemberExpression(node: JSNode): node is MemberExpression {
    return node.type === 'MemberExpression';
}

function isCallExpression(node: JSNode): node is CallExpression {
    return node.type === 'CallExpression';
}

function isFunction(node: JSNode): node is ArrowFunctionExpression {
    return node.type === 'ArrowFunctionExpression';
}

function isArray(node: JSNode): node is ArrayExpression {
    return node.type === 'ArrayExpression';
}

function getterPrefix(context: string): ENDGetterPrefix {
    return { type: 'ENDGetterPrefix', context };
}
