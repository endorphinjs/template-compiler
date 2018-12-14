export interface SourceLocation {
    source?: string | null;
    start: Position;
    end: Position;
}

export interface Position {
    line: number; // >= 1
    column: number; // >= 0
    pos: number; // >= 0
}

export class Node {
    type: string;
    loc?: SourceLocation;
}

/**
 * Unsupported JS types in Endorphin templates
 */
export const unsupportedNodes = new Set([
    'ThisExpression', 'AsyncArrowFunctionExpression', 'AsyncFunctionExpression',
    'AwaitExpression', 'ClassExpression', 'FunctionExpression', 'NewExpression',
    'StaticMemberExpression', 'YieldExpression', 'VariableDeclaration',
    'AsyncFunctionDeclaration', 'ClassDeclaration', 'FunctionDeclaration',
    'ExportDeclaration', 'ExportAllDeclaration', 'ExportDefaultDeclaration', 'ExportNamedDeclaration',
    'ImportDeclaration', 'ImportDefaultSpecifier', 'ImportNamespaceSpecifier', 'ImportSpecifier',
    'AsyncFunctionDeclaration', 'BreakStatement', 'ContinueStatement', 'DebuggerStatement', 'DoWhileStatement',
    'ForStatement', 'ForInStatement', 'ForOfStatement', 'IfStatement', 'ReturnStatement', 'SwitchStatement', 'ThrowStatement',
    'TryStatement', 'WhileStatement', 'WithStatement',
    'TaggedTemplateExpression', 'Directive'
]);

/**
 * JavaScript AST
 */
export type ArgumentListElement = Expression | SpreadElement;
export type ArrayExpressionElement = Expression | SpreadElement | null;
export type ArrayPatternElement = AssignmentPattern | BindingIdentifier | BindingPattern | RestElement | null;
export type BindingPattern = ArrayExpression | ObjectExpression;
export type BindingIdentifier = Identifier;
export type Expression = ArrayExpression | ArrowFunctionExpression | AssignmentExpression
    | BinaryExpression | LogicalExpression | CallExpression | MemberExpression | ConditionalExpression
    | Identifier | Literal | ObjectExpression | RegExpLiteral | SequenceExpression
    | UnaryExpression | UpdateExpression;
export type FunctionParameter = AssignmentPattern | BindingIdentifier | BindingPattern;
export type ObjectExpressionProperty = Property | SpreadElement;
export type ObjectPatternProperty = Property | RestElement;
export type Statement = EmptyStatement | ExpressionStatement;
export type PropertyKey = Identifier | Literal;
export type PropertyValue = AssignmentPattern | BindingIdentifier | BindingPattern;

export class Literal extends Node {
    type = 'Literal';
    constructor(readonly value: boolean | number | string | null, readonly raw: string) {
        super();
    }
}

export class Identifier extends Node {
    type = 'Identifier';
    constructor(readonly name: string) {
        super();
    }
}

export class AssignmentPattern extends Node {
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

export class SpreadElement extends Node {
    type = 'SpreadElement';
    constructor(readonly argument: Expression) {
        super();
    }
}

export class RestElement extends Node {
    type = 'RestElement';
    constructor(readonly argument: BindingIdentifier | BindingPattern) {
        super();
    }
}

export class ArrayExpression extends Node {
    type = 'ArrayExpression';
    constructor(readonly elements: ArrayPatternElement[]) {
        super();
    }
}

export class ObjectExpression extends Node {
    type = 'ObjectExpression';
    constructor(readonly properties: Property[]) {
        super();
    }
}

export class Property extends Node {
    type = 'string';
    constructor(readonly kind: "init" | "get" | "set", readonly key: PropertyKey,
        readonly computed: boolean, readonly value: Expression | null,
        readonly method: boolean, readonly shorthand: boolean) {
        super();
    }
}

export class ArrowFunctionExpression extends Node {
    type = 'ArrowFunctionExpression';
    readonly id: Identifier | null = null;
    readonly generator: boolean = false;
    readonly async: boolean = false;
    constructor(readonly params: FunctionParameter[], readonly body: BlockStatement | Expression, readonly expression: boolean) {
        super();
    }
}

export class AssignmentExpression extends Node {
    type = 'AssignmentExpression';
    constructor(readonly operator: string, readonly left: Expression, readonly right: Expression) {
        super();
    }
}

export class BinaryExpression extends Node {
    type = 'BinaryExpression';
    constructor(readonly operator: string, readonly left: Expression, readonly right: Expression) {
        super();
    }
}

export class LogicalExpression extends Node {
    type = 'LogicalExpression';
    constructor(readonly operator: string, readonly left: Expression, readonly right: Expression) {
        super();
    }
}

export class CallExpression extends Node {
    type = 'CallExpression';
    readonly arguments: ArgumentListElement[];
    constructor(readonly callee: Expression, args: ArgumentListElement[]) {
        super();
        this.arguments = args;
    }
}

export class MemberExpression extends Node {
    type = 'MemberExpression';
    constructor(readonly object: Expression, readonly property: Expression, readonly computed: boolean) {
        super();
    }
}

export class ConditionalExpression extends Node {
    type = 'ConditionalExpression';
    constructor(readonly test: Expression, readonly consequent: Expression, readonly alternate: Expression) {
        super();
    }
}

export class RegExpLiteral extends Node {
    type = 'RegExpLiteral';
    readonly regex: { pattern: string, flags: string };
    constructor(pattern: string, flags: string) {
        super();
        this.regex = { pattern, flags };
    }
}

export class SequenceExpression extends Node {
    type = 'SequenceExpression';
    constructor(readonly expressions: Expression[]) {
        super();
    }
}

export class UnaryExpression extends Node {
    type = 'UnaryExpression';
    readonly prefix: boolean = true;
    constructor(readonly operator: string, readonly argument: Expression) {
        super();
    }
}

export class UpdateExpression extends Node {
    type = 'UpdateExpression';
    constructor(readonly operator: string, readonly argument: Expression, readonly prefix: boolean = false) {
        super();
    }
}

export class ExpressionStatement extends Node {
    type = 'ExpressionStatement';
    constructor(readonly expression: Expression) {
        super();
    }
}

export class EmptyStatement extends Node {
    type = 'EmptyStatement';
}

export class BlockStatement extends Node {
    type = 'BlockStatement';
    constructor(readonly body: Statement[]) {
        super();
    }
}

// Endorphin AST

export type ENDStatement = ENDElement | ENDPlainStatement | ENDAttributeStatement | ENDAddClassStatement | ENDVariableStatement | ENDControlStatement;
export type ENDProgramStatement = ENDTemplate | ENDElement;
export type ENDControlStatement = ENDIfStatement | ENDChooseStatement | ENDForEachStatement | ENDPartialStatement;
export type ENDPlainStatement = ENDText | Expression;

export class ENDProgram {
    type = 'ENDProgram';
    readonly body: ENDProgramStatement[];
    constructor() {
        this.body = [];
    }
}

export class ENDTemplate extends Node {
    type = 'ENDTemplate';
    readonly body: ENDStatement[];
    constructor(readonly name?: Literal) {
        super();
        this.body = [];
    }
}

export class ENDElement extends Node {
    type = 'ENDElement';
    readonly body: ENDStatement[];
    constructor(readonly name: Identifier, readonly attributes: ENDAttribute[]) {
        super();
        this.body = [];
    }
}

export class ENDAttribute extends Node {
    type = 'ENDAttribute';
    constructor(readonly name: Expression, readonly value: Expression | null) {
        super();
        if (name.loc && value.loc) {
            this.loc = {
                start: name.loc.start,
                end: value ? value.loc.end : name.loc.end
            };
        }
    }
}

export class ENDEvent extends Node {
    type = 'ENDEvent';
    constructor(readonly name: Identifier, readonly handler: Expression) {
        super();
    }
}

export class ENDIfStatement extends Node {
    type = 'ENDIfStatement';
    consequent: ENDStatement[];
    constructor(readonly test: Expression) {
        super();
        this.consequent = [];
    }
}

export class ENDChooseStatement extends Node {
    type = 'ENDChooseStatement';
    cases: ENDChooseCase[];
    constructor() {
        super();
        this.cases = [];
    }
}

export class ENDChooseCase extends Node {
    type = 'ENDSwitchCase';
    consequent: ENDStatement[];
    constructor(readonly test: Expression | null = null) {
        super();
        this.consequent = [];
    }
}

export class ENDForEachStatement extends Node {
    type = 'ENDForEachStatement';
    readonly body: ENDStatement[];
    constructor(readonly select: Expression) {
        super();
        this.body = [];
    }
}

export class ENDPartialStatement extends Node {
    type = 'ENDForEachStatement';
    constructor(readonly id: Identifier, readonly params: AssignmentPattern[]) {
        super();
    }
}

export class ENDVariableStatement extends Node {
    type = 'ENDVariableStatement';
    variables: AssignmentPattern[]
    constructor() {
        super();
        this.variables = [];
    }
}

export class ENDAttributeStatement extends Node {
    type = 'ENDAttributeStatement';
    attributes: ENDAttribute[];
    test: Expression | null;
    constructor() {
        super();
        this.attributes = [];
    }
}

export class ENDAddClassStatement extends Node {
    type = 'ENDAddClassStatement';
    tokens: ENDPlainStatement[];
    constructor() {
        super();
        this.tokens = [];
    }
}

export class ENDText extends Node {
    type = 'ENDText';
    constructor(readonly value: string) {
        super();
    }
}
