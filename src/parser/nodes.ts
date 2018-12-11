/**
 * Endorphin template AST. Inspired by ESTree format: https://github.com/estree/estree/
 */

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

export type Expression = Literal | Identifier;

export type Statement = ENDElement | PlainStatement | ENDAttribute | ENDClass | ControlStatement;
export type ProgramStatement = ENDTemplate | ENDElement;
export type ControlStatement = ENDIfStatement | ENDChooseStatement | ENDForEachStatement | ENDPartialStatement;
export type PlainStatement = ENDText | Expression;

export class Node {
    readonly type: string;
    loc?: SourceLocation;
}

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
    constructor(readonly left: Identifier, readonly right: Expression) {
        super();
    }
}

export class ENDProgram {
    type = 'ENDProgram';
    readonly body: ProgramStatement[];
    constructor() {
        this.body = [];
    }
}

export class ENDTemplate extends Node {
    type = 'ENDTemplate';
    readonly body: Statement[];
    constructor(readonly name?: Literal) {
        super();
        this.body = [];
    }
}

export class ENDElement extends Node {
    type = 'ENDElement';
    readonly body: Statement[];
    constructor(readonly name: Identifier, readonly attributes: ENDAttribute[]) {
        super();
        this.body = [];
    }
}

export class ENDAttribute extends Node {
    type = 'ENDAttribute';
    constructor(readonly name: Identifier, readonly value: Expression | null, readonly condition: Expression | null = null) {
        super();
        this.loc = {
            start: name.loc.start,
            end: value ? value.loc.end : name.loc.end
        };
    }
}

export class ENDClass extends Node {
    type = 'ENDClass';
    value: PlainStatement[];
    constructor(readonly condition: Expression | null) {
        super();
        this.value = [];
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
    consequent: Statement[];
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
    consequent: Statement[];
    constructor(readonly test: Expression | null = null) {
        super();
        this.consequent = [];
    }
}

export class ENDForEachStatement extends Node {
    type = 'ENDForEachStatement';
    readonly body: Statement[];
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
    constructor(readonly name: Identifier, readonly value: Expression) {
        super();
    }
}

export class ENDText extends Node {
    type = 'ENDText';
    constructor(readonly value: string) {
        super();
    }
}
