import {
    ENDDirective, JSNode, Expression, ENDGetterPrefix, Identifier, ExpressionStatement,
    ArrowFunctionExpression, ENDCaller, ThisExpression, MemberExpression, ENDAttributeValue,
    CallExpression, IdentifierContext
} from "@endorphinjs/template-parser";
import Entity from "./Entity";
import CompileState from "./CompileState";
import generateExpression from "../expression";
import { WalkVisitorMap, getPrefix } from "../expression/utils";
import { sn, nameToJS, isExpression, isIdentifier, isLiteral, runtime, qStr, unmount } from "../utils";
import { ENDCompileError } from "../error";

export default class EventEntity extends Entity {
    constructor(readonly node: ENDDirective, readonly state: CompileState) {
        super(node.name.split(':')[0], state);

        const eventType = this.rawName;
        const { element } = state;
        const handler = createEventHandler(node, state);

        if (!element.node || element.dynamicEvents.has(eventType) || element.hasPartials) {
            this.setShared(() => runtime('addEvent', [element.injector, qStr(eventType), handler], state));
        } else {
            // Add as static event
            this.setMount(() => runtime('addStaticEvent', [element.getSymbol(), qStr(eventType), handler, state.host, state.scope], state));
            this.setUnmount(() => unmount('removeStaticEvent', this.getSymbol(), state));
        }
    }
}

const eventVisitors = {
    ENDGetterPrefix(node: ENDGetterPrefix, state) {
        if (node.context !== 'helper') {
            return sn(`this.${getPrefix(node.context, state)}`);
        }

        return sn();
    },
    ThisExpression() {
        return sn('this.host');
    }
} as WalkVisitorMap;

function compile(node: JSNode, state: CompileState) {
    return generateExpression(node, state, eventVisitors);
}

function createEventHandler(node: ENDDirective, state: CompileState) {
    const [eventName, ...modifiers] = node.name.split(':');
    const handlerName = state.globalSymbol(`on${nameToJS(eventName, true)}`);
    const handler = getHandler(node.value);

    if (!modifiers.length && !handler) {
        throw new ENDCompileError(`Event handler must be expression`, node.value);
    }

    const { indent } = state;
    const eventArg = getEventArgName(handler);
    const needEventArg = modifiers.length > 0 || handlerUsesEvent(handler);
    const handlerFn = sn(`function ${handlerName}(${needEventArg ? eventArg : ''}) {\n`, node);

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
            handlerFn.add([indent, compile(constructCall(handler, eventArg), state), ';']);
        }
    }

    handlerFn.add('\n}');

    state.pushOutput(handlerFn);
    return handlerName;
}

function getHandler(node: ENDAttributeValue | null): Expression {
    if (node && isExpression(node) && node.body.length) {
        return (node.body[0] as ExpressionStatement).expression;
    }
}

function isCaller(node: JSNode): node is ENDCaller {
    return node.type === 'ENDCaller';
}

function isCallExpression(node: JSNode): node is CallExpression {
    return node.type === 'CallExpression';
}

function isArrowFunction(node: JSNode): node is ArrowFunctionExpression {
    return node.type === 'ArrowFunctionExpression';
}

function isPrefix(node: JSNode): node is ENDGetterPrefix {
    return node.type === 'ENDGetterPrefix';
}

function getEventArgName(handler: Expression | void): string {
    if (handler && isArrowFunction(handler) && handler.params.length && isIdentifier(handler.params[0])) {
        return (handler.params[0] as Identifier).name;
    }

    return 'evt';
}

/**
 * Constructs handler caller AST node from given one, if required
 */
function constructCall(node: JSNode, eventArg: string): JSNode {
    const evt = identifier(eventArg);
    const host = { type: 'ThisExpression' } as ThisExpression;
    const target = {
        type: 'MemberExpression',
        object: evt,
        property: identifier('currentTarget')
    } as MemberExpression;

    if (isIdentifier(node)) {
        return {
            type: 'CallExpression',
            callee: node,
            arguments: [host, evt, target],
            loc: node.loc
        } as CallExpression;
    }

    if (isCaller(node) && isPrefix(node.object) && isLiteral(node.property)) {
        // Convert caller back to call expression to throw errors if
        // callee doesn’t exists
        const context: IdentifierContext = node.object.context === 'property'
            ? 'definition' : node.object.context
        return {
            type: 'CallExpression',
            callee: identifier(node.property.value as string, context),
            arguments: [...node.arguments, host, evt, target],
            loc: node.loc
        } as CallExpression;
    }

    if (isCallExpression(node) && (!isIdentifier(node.callee) || node.callee.context !== 'helper')) {
        return {
            ...node,
            arguments: [...node.arguments, host, evt, target]
        } as CallExpression
    }

    return node;
}

function identifier(name: string, context?: IdentifierContext): Identifier {
    return { type: 'Identifier', name, context };
}

function handlerUsesEvent(handler: Expression | void): boolean {
    if (!handler) {
        return false;
    }

    if (isArrowFunction(handler)) {
        return handler.params.length > 0;
    }

    if (isCallExpression(handler)) {
        return !isIdentifier(handler.callee) || handler.callee.context !== 'helper';
    }

    return true;
}
