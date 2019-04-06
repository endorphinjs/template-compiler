import * as acornWalk from 'acorn-walk';
import { ENDFilter, ENDGetter } from './expression';
import { Node } from './base';
import {
    ENDProgram, ENDTemplate, ENDPartial, ENDElement, ENDAttribute, ENDDirective,
    ENDAttributeValueExpression, ENDVariable, ENDIfStatement, ENDChooseStatement,
    ENDChooseCase, ENDForEachStatement, ENDPartialStatement, ENDVariableStatement,
    ENDAttributeStatement, ENDAddClassStatement, ENDInnerHTML
} from './template';

interface AstWalker<T> {
    (node: Node, state: T, c: AstWalkerContinuation<T>): void;
}

interface AstWalkerContinuation<T> {
    (node: Node, state: T, type?: string): void;
}

interface AstVisitors<T> {
    [nodeType: string]: AstWalker<T>
}

interface AstVisitor<T, U> {
    (node: Node, state: T, addon: U): void;
}

interface AstVisitorMap<T, U> {
    [nodeType: string]: AstVisitor<T, U>
}

interface AstVisitorCallback<T> {
    (node: Node, state: T, type: string): void;
}

interface AstAncestorVisitorCallback<T> {
    (node: Node, state: T, ancestors: Node[], type: string): void;
}

interface TestFn {
    (type: string): boolean;
}

const ignore: AstWalker<object> = () => {};

/**
 * A simple walk is one where you simply specify callbacks to be
 * called on specific nodes. The last two arguments are optional. A
 * simple use would be
 *
 * ```js
 * walk.simple(myTree, {
 *     Expression(node) { ... }
 * });
 * ```
 *
 * to do something with all expressions. All Parser API node types
 * can be used to identify node types, as well as Expression and
 * Statement, which denote categories of nodes.
 *
 * The base argument can be used to pass a custom (recursive)
 * walker, and state can be used to give this walked an initial
 * state.
 */
export function simple<T>(node: Node, visitors: AstVisitorMap<T, void>, baseVisitor = base, state?: T, override?: string): void {
    acornWalk.simple(node, visitors, baseVisitor, state, override);
}

/**
 * An ancestor walk keeps an array of ancestor nodes (including the
 * current node) and passes them to the callback as third parameter
 * (and also as state parameter when no other state is present).
 */
export function ancestor<T>(node: Node, visitors: AstVisitorMap<T, Node[]>, baseVisitor = base, state?: T): void {
    acornWalk.ancestor(node, visitors, baseVisitor, state);
}

/**
 * A recursive walk is one where your functions override the default
 * walkers. They can modify and replace the state parameter that's
 * threaded through the walk, and can opt how and whether to walk
 * their child nodes (by calling their third argument on these
 * nodes).
 */
export function recursive<T>(node: Node, state?: T, funcs?: AstVisitors<T>, baseVisitor = base, override?: string): void {
    acornWalk.recursive(node, state, funcs, baseVisitor, override);
}

/**
 *  A full walk triggers the callback on each node
 */
export function full<T>(node: Node, callback: AstVisitorCallback<T>, baseVisitor = base, state?: T, override?: string): void {
    acornWalk.full(node, callback, baseVisitor, state, override);
}

/**
 * An fullAncestor walk is like an ancestor walk, but triggers
 * the callback on each node
 */
export function fullAncestor<T>(node: Node, callback: AstAncestorVisitorCallback<T>, baseVisitor = base, state?: T) {
    acornWalk.fullAncestor(node, callback, baseVisitor, state);
}

/**
 * Find a node with a given start, end, and type (all are optional,
 * null can be used as wildcard). Returns a `{node, state}` object, or
 * `undefined` when it doesn't find a matching node.
 */
export function findNodeAt<T>(node: Node, start?: number | null, end?: number | null, test?: string | TestFn | null, baseVisitor = base, state?: T): { node: Node, state: T } {
    return acornWalk.findNodeAt(node, start, end, test, baseVisitor, state);
}

/**
 * Find the innermost node of a given type that contains the given
 * position. Interface similar to `findNodeAt`.
 */
export function findNodeAround<T>(node: Node, pos: number, test: string | TestFn | null, baseVisitor = base, state?: T): { node: Node, state: T } {
    return acornWalk.findNodeAround(node, pos, test, baseVisitor, state);
}

/**
 * Find the outermost matching node after a given position.
 */
export function findNodeAfter<T>(node: Node, pos: number, test: string | TestFn | null, baseVisitor = base, state?: T): { node: Node, state: T } {
    return acornWalk.findNodeAfter(node, pos, test, baseVisitor, state);
}

/**
 * Find the outermost matching node before a given position.
 */
export function findNodeBefore<T>(node: Node, pos: number, test: string | TestFn | null, baseVisitor = base, state?: T): { node: Node, state: T } {
    return acornWalk.findNodeAfter(node, pos, test, baseVisitor, state);
}

export const base: AstVisitors<object> = acornWalk.make(<AstVisitors<object>>{
    ENDIdentifier: ignore,
    ENDPropertyIdentifier: ignore,
    ENDStateIdentifier: ignore,
    ENDStoreIdentifier: ignore,
    ENDVariableIdentifier: ignore,
    ENDFilter(node: ENDFilter, state, c) {
        c(node.object, state);
        c(node.filter, state);
    },
    ENDGetter(node: ENDGetter, state, c) {
        c(node.root, state);
        walkArray(node.path, state, c);
    },
    ENDProgram(node: ENDProgram, state, c) {
        walkArray(node.body, state, c);
        walkArray(node.stylesheets, state, c);
        walkArray(node.scripts, state, c);
    },
    ENDTemplate(node: ENDTemplate, state, c) {
        walkArray(node.body, state, c);
    },
    ENDPartial(node: ENDPartial, state, c) {
        c(node.id, state);
        walkArray(node.params, state, c);
        walkArray(node.body, state, c);
    },
    ENDElement(node: ENDElement, state, c) {
        c(node.name, state);
        walkArray(node.attributes, state, c);
        walkArray(node.directives, state, c);
        walkArray(node.body, state, c);
    },
    ENDAttribute(node: ENDAttribute, state, c) {
        c(node.name, state);
        c(node.value, state);
    },
    ENDDirective(node: ENDDirective, state, c) {
        c(node.name, state);
        c(node.value, state);
    },
    ENDAttributeValueExpression(node: ENDAttributeValueExpression, state, c) {
        walkArray(node.elements, state, c);
    },
    ENDVariable(node: ENDVariable, state, c) {
        c(node.name, state);
        c(node.value, state);
    },
    ENDIfStatement(node: ENDIfStatement, state, c) {
        c(node.test, state);
        walkArray(node.consequent, state, c);
    },
    ENDChooseStatement(node: ENDChooseStatement, state, c) {
        walkArray(node.cases, state, c);
    },
    ENDChooseCase(node: ENDChooseCase, state, c) {
        c(node.test, state);
        walkArray(node.consequent, state, c);
    },
    ENDForEachStatement(node: ENDForEachStatement, state, c) {
        c(node.select, state);
        if (node.key) {
            c(node.key, state);
        }
        walkArray(node.body, state, c);
    },
    ENDPartialStatement(node: ENDPartialStatement, state, c) {
        c(node.id, state);
        walkArray(node.params, state, c);
    },
    ENDVariableStatement(node: ENDVariableStatement, state, c) {
        walkArray(node.variables, state, c);
    },
    ENDAttributeStatement(node: ENDAttributeStatement, state, c) {
        walkArray(node.attributes, state, c);
        walkArray(node.directives, state, c);
    },
    ENDAddClassStatement(node: ENDAddClassStatement, state, c) {
        walkArray(node.tokens, state, c);
    },
    ENDText: ignore,
    ENDInnerHTML(node: ENDInnerHTML, state, c) {
        c(node.value, state);
    },
    ENDImport: ignore,
    ENDStylesheet: ignore,
    ENDScript: ignore
});

function walkArray<T>(nodes: Node[], state: T, c: AstWalkerContinuation<T>) {
    nodes.forEach(node => c(node, state));
}
