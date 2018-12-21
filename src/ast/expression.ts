/**
 * AST descriptors for JavaScript-like expressions
 */

import { Node } from './base';

export type ArgumentListElement = Expression | SpreadElement;
export type ArrayExpressionElement = Expression | SpreadElement | null;
export type ArrayPatternElement = AssignmentPattern | BindingPattern | RestElement | null;
export type BindingPattern = ArrayExpression | ObjectExpression | Identifier | ENDGetter;
export type Expression = ArrayExpression | ArrowFunctionExpression | AssignmentExpression
    | BinaryExpression | LogicalExpression | CallExpression | MemberExpression | ConditionalExpression
    | Identifier | Literal | ObjectExpression | RegExpLiteral | SequenceExpression
    | UnaryExpression | UpdateExpression | ENDGetter;
export type FunctionParameter = AssignmentPattern | BindingPattern;
export type ObjectExpressionProperty = Property | SpreadElement;
export type ObjectPatternProperty = Property | RestElement;
export type Statement = ReturnStatement | EmptyStatement | ExpressionStatement;
export type PropertyKey = Identifier | Literal;
export type PropertyValue = BindingPattern | Literal;

export class JSNode extends Node {}

export class Program extends JSNode {
    type = 'Program';
    raw: string;
    constructor(readonly body: Statement[]) {
        super();
    }
}

export class Literal extends JSNode {
    type = 'Literal';
    constructor(readonly value: boolean | number | string | null, readonly raw: string) {
        super();
    }
}

export class Identifier extends JSNode {
    type = 'Identifier';
    constructor(readonly name: string) {
        super();
    }
}

export class FunctionDeclaration extends JSNode {
    type = 'FunctionDeclaration';
    constructor(readonly id: Identifier, readonly params: FunctionParameter[], readonly body: BlockStatement | Expression) {
        super();
    }
}

export class AssignmentPattern extends JSNode {
    type = 'AssignmentPattern';
    constructor(readonly left: Expression, readonly right: Expression) {
        super();
        if (left.loc && right.loc) {
            this.loc = {
                start: left.loc.start,
                end: right.loc.end
            };
        }
    }
}

export class SpreadElement extends JSNode {
    type = 'SpreadElement';
    constructor(readonly argument: Expression) {
        super();
    }
}

export class RestElement extends JSNode {
    type = 'RestElement';
    constructor(readonly argument: BindingPattern) {
        super();
    }
}

export class ArrayExpression extends JSNode {
    type = 'ArrayExpression';
    constructor(readonly elements: ArrayPatternElement[]) {
        super();
    }
}

export class ObjectExpression extends JSNode {
    type = 'ObjectExpression';
    constructor(readonly properties: Property[]) {
        super();
    }
}

export class Property extends JSNode {
    type = 'Property';
    constructor(readonly kind: 'init' | 'get' | 'set', readonly key: PropertyKey,
        readonly computed: boolean, readonly value: Expression | null,
        readonly method: boolean, readonly shorthand: boolean) {
        super();
    }
}

export class ArrowFunctionExpression extends JSNode {
    type = 'ArrowFunctionExpression';
    readonly generator: boolean = false;
    readonly async: boolean = false;
    constructor(readonly id: Identifier | null = null, readonly params: FunctionParameter[], readonly body: BlockStatement | Expression, readonly expression: boolean) {
        super();
    }
}

export class AssignmentExpression extends JSNode {
    type = 'AssignmentExpression';
    constructor(readonly operator: string, readonly left: Expression, readonly right: Expression) {
        super();
    }
}

export class BinaryExpression extends JSNode {
    type = 'BinaryExpression';
    constructor(readonly operator: string, readonly left: Expression, readonly right: Expression) {
        super();
    }
}

export class LogicalExpression extends JSNode {
    type = 'LogicalExpression';
    constructor(readonly operator: string, readonly left: Expression, readonly right: Expression) {
        super();
    }
}

export class CallExpression extends JSNode {
    type = 'CallExpression';
    readonly arguments: ArgumentListElement[];
    constructor(readonly callee: Expression, args: ArgumentListElement[]) {
        super();
        this.arguments = args;
    }
}

export class MemberExpression extends JSNode {
    type = 'MemberExpression';
    constructor(readonly object: Expression, readonly property: Expression, readonly computed: boolean) {
        super();
    }
}

export class ConditionalExpression extends JSNode {
    type = 'ConditionalExpression';
    constructor(readonly test: Expression, readonly consequent: Expression, readonly alternate: Expression) {
        super();
    }
}

export class RegExpLiteral extends JSNode {
    type = 'RegExpLiteral';
    readonly regex: { pattern: string, flags: string };
    constructor(pattern: string, flags: string) {
        super();
        this.regex = { pattern, flags };
    }
}

export class SequenceExpression extends JSNode {
    type = 'SequenceExpression';
    constructor(readonly expressions: Expression[]) {
        super();
    }
}

export class UnaryExpression extends JSNode {
    type = 'UnaryExpression';
    readonly prefix: boolean = true;
    constructor(readonly operator: string, readonly argument: Expression) {
        super();
    }
}

export class UpdateExpression extends JSNode {
    type = 'UpdateExpression';
    constructor(readonly operator: string, readonly argument: Expression, readonly prefix: boolean = false) {
        super();
    }
}

export class ExpressionStatement extends JSNode {
    type = 'ExpressionStatement';
    constructor(readonly expression: Expression) {
        super();
    }
}

export class EmptyStatement extends JSNode {
    type = 'EmptyStatement';
}

export class ReturnStatement extends JSNode {
    type = 'ReturnStatement';
    constructor(readonly argument: Expression | null) {
        super();
    }
}

export class BlockStatement extends JSNode {
    type = 'BlockStatement';
    constructor(readonly body: Statement[]) {
        super();
    }
}

// Endorphin extensions to JavaScript expressions
export type ENDIdentifier = ENDPropertyIdentifier | ENDStateIdentifier | ENDStoreIdentifier | ENDVariableIdentifier;

export class ENDPropertyIdentifier extends Identifier {
    type = 'ENDPropertyIdentifier';
    constructor(readonly name: string, readonly raw: string) {
        super(name);
    }
}

export class ENDStateIdentifier extends Identifier {
    type = 'ENDStateIdentifier';
    constructor(readonly name: string, readonly raw: string) {
        super(name);
    }
}

export class ENDStoreIdentifier extends Identifier {
    type = 'ENDStoreIdentifier';
    constructor(readonly name: string, readonly raw: string) {
        super(name);
    }
}

export class ENDVariableIdentifier extends Identifier {
    type = 'ENDVariableIdentifier';
    constructor(readonly name: string, readonly raw: string) {
        super(name);
    }
}

export class ENDFilter extends JSNode {
    type = 'ENDFilter';
    constructor(readonly object: Expression, readonly filter: ArrowFunctionExpression) {
        super();
    }
}

export class ENDGetter extends JSNode {
    type = 'ENDGetter';
    constructor(readonly root: ENDIdentifier | ENDFilter, readonly path: Expression[] = []) {
        super();
    }
}
