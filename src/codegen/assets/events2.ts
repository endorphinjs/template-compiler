import { Identifier, FunctionDeclaration, CallExpression, ThisExpression, ArrowFunctionExpression, ENDPropertyIdentifier, BlockStatement, Statement, MemberExpression } from '../../ast/expression';
import CompileScope from '../scope';
import { simple as walk } from '../../ast/walk';

type EventHandlerOption = 'stop' | 'prevent';

/**
 * Generate event handler from given identifier
 */
export function createHandlerFromId(name: string, node: Identifier, scope: CompileScope): FunctionDeclaration {
    const eventArg = new Identifier('event');
    return new FunctionDeclaration(
        new Identifier(name),
        [eventArg],
        new CallExpression(node, [
            new Identifier(scope.host),
            eventArg,
            new ThisExpression()
        ])
    );
}

/**
 * Generate event handler from given function call
 */
export function createHandlerFromCall(name: string, node: CallExpression, scope: CompileScope): FunctionDeclaration {
    const eventArg = new Identifier('event');
    return new FunctionDeclaration(
        new Identifier(name),
        [eventArg],
        new CallExpression(node.callee, [
            ...node.arguments,
            new Identifier(scope.host),
            eventArg,
            new ThisExpression()
        ])
    );
}

/**
 * Generate event handler from given arrow function call
 */
export function createHandlerFromArrow(name: string, node: ArrowFunctionExpression, scope: CompileScope): FunctionDeclaration {
    const eventArg = node.params[0] || new Identifier('event');
    const host = new Identifier(scope.host);
    const target = new ThisExpression();

    // Supply all top-level call expressions with additional arguments
    walk(node.body, {
        CallExpression(node: CallExpression) {
            if (node.callee instanceof ENDPropertyIdentifier) {
                node.arguments.push(host, eventArg, target);
            }
        }
    });

    return new FunctionDeclaration(new Identifier(name), node.params, node.body);
}

function createEventBody(eventArg: Identifier, options: EventHandlerOption[] = [], handler?: Statement): BlockStatement {
    const block = new BlockStatement();
    if (options.includes('stop')) {
        block.body.push(methodCall(eventArg.name, 'stopPropagation'))
    }

    if (options.includes('prevent')) {
        block.body.push(methodCall(eventArg.name, 'preventDefault'))
    }

    if (handler) {
        block.body.push(handler);
    }

    return block;
}

function methodCall(obj: string, method: string): CallExpression {
    return new CallExpression(
        new MemberExpression(
            new Identifier(obj),
            new Identifier(method)
        )
    );
}
