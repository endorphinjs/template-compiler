import {
    ENDDirective, JSNode, Expression, ENDGetterPrefix, CallExpression, Identifier,
    ExpressionStatement, ArrowFunctionExpression
} from "@endorphinjs/template-parser";
import Entity from "./Entity";
import CompileState from "./CompileState";
import generateExpression from "../expression";
import { WalkVisitorMap, getPrefix } from "../expression/utils";
import { sn, nameToJS, isExpression, isIdentifier } from "../utils";
import { ENDCompileError } from "../error";

export default class EventEntity extends Entity {
    constructor(readonly node: ENDDirective, readonly state: CompileState) {
        super('event', state);
        this.setMount(() => {
            const handler = createEventHandler(node, state);
            return sn([`{ host: ${state.host}, scope: ${state.scope}, target: `, state.element.getSymbol(), `, handleEvent: ${handler} }`])
        });
    }
}

const eventVisitors = {
    ENDGetterPrefix(node: ENDGetterPrefix, state) {
        return sn(['this.', getPrefix(node.context, state)]);
    }
} as WalkVisitorMap;

function compile(node: JSNode, state: CompileState) {
    return generateExpression(node, state, eventVisitors);
}

function createEventHandler(node: ENDDirective, state: CompileState) {
    const [eventName, ...modifiers] = node.name.split(':');
    const handlerName = state.globalSymbol(`on${nameToJS(eventName, true)}`);
    let handler: Expression | void;

    if (!modifiers.length && (!node.value || !isExpression(node.value) || !node.value.body.length)) {
        throw new ENDCompileError(`Event handler must be expression`, node.value);
    }

    if (node.value && isExpression(node.value) && node.value.body.length) {
        handler = (node.value.body[0] as ExpressionStatement).expression;
    }

    const eventArg = getEventArgName(handler);

    const { indent } = state;
    const handlerFn = sn(`function ${handlerName}(${eventArg}) {\n`, node);

    // Handle event modifiers
    modifiers.forEach(m => {
        if (m === 'stop') {
            handlerFn.add(`${indent}${eventArg}.stopPropagation();\n`);
        } else if (m === 'prevent') {
            handlerFn.add(`${indent}${eventArg}.preventDefault();\n`);
        }
    });

    if (handler) {
        if (isArrowFunction(handler)) {
            if (handler.body.type === 'BlockStatement') {
                handler.body.body.forEach(expr => {
                    handlerFn.add([indent, compile(expr, state)]);
                    if (expr.type === 'ExpressionStatement') {
                        handlerFn.add(';\n');
                    }
                });
            } else {
                handlerFn.add(compile(handler.body, state));
            }
        } else {
            const host = `this.${state.host}`;
            const symbol = getHandlerSymbol(handler);
            if (symbol in state.helpers) {
                // Calling helper function
                handlerFn.add([indent, state.helper(symbol), `(${host}`]);

                if (isCallExpression(handler)) {
                    // on:click={handler(foo, bar)}
                    // Add arguments to function handler but ensure that variables are fetched
                    // from local JS variable: it is required for proper variable scoping in loops
                    handler.arguments.forEach(arg => {
                        handlerFn.add([', ', compile(arg, state)]);
                    });
                }
                handlerFn.add(`);`);
            } else {
                handlerFn.add([
                    `${indent}${host}.componentModel.definition.${symbol}(`
                ]);

                if (isCallExpression(handler)) {
                    // on:click={handler(foo, bar)}
                    // Add arguments to function handler but ensure that variables are fetched
                    // from local JS variable: it is required for proper variable scoping in loops
                    handler.arguments.forEach(arg => {
                        handlerFn.add([compile(arg, state), ', ']);
                    });
                }

                handlerFn.add(`${host}, ${eventArg}, this.target);`);
            }
        }
    }

    handlerFn.add('\n}');

    state.pushOutput(handlerFn);
    return handlerName;
}

function getHandlerSymbol(node: JSNode): string {
    if (isIdentifier(node)) {
        return node.name;
    }

    if (isCallExpression(node) && isIdentifier(node.callee)) {
        return node.callee.name;
    }

    throw new ENDCompileError(`Unable to get handler name from event expression`, node);
}

function isCallExpression(node: JSNode): node is CallExpression {
    return node.type === 'CallExpression';
}

function isArrowFunction(node: JSNode): node is ArrowFunctionExpression {
    return node.type === 'ArrowFunctionExpression';
}

function getEventArgName(handler: Expression | void): string {
    if (handler && isArrowFunction(handler) && handler.params.length && isIdentifier(handler.params[0])) {
        return (handler.params[0] as Identifier).name;
    }

    return 'evt';
}
