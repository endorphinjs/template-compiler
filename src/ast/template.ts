/**
 * AST descriptors for Endorphin templates
 */

import { Node } from './base';
import { Identifier, Program, Literal, Expression } from './expression';

export type ENDStatement = ENDElement | ENDPlainStatement | ENDAttributeStatement | ENDAddClassStatement | ENDVariableStatement | ENDControlStatement;
export type ENDProgramStatement = ENDTemplate | ENDElement;
export type ENDControlStatement = ENDIfStatement | ENDChooseStatement | ENDForEachStatement | ENDPartialStatement;
export type ENDPlainStatement = ENDText | Program;
export type ENDAttributeName = Identifier | Program;
export type ENDBaseAttributeValue = Literal | Program;
export type ENDAttributeValue = ENDBaseAttributeValue | ENDAttributeValueExpression | null;

export class ENDNode extends Node {

}

export class ENDProgram extends ENDNode {
    type = 'ENDProgram';
    constructor(readonly body: ENDProgramStatement[] = []) {
        super();
    }
}

export class ENDTemplate extends ENDNode {
    type = 'ENDTemplate';
    constructor(readonly name?: Literal, readonly body: ENDStatement[] = []) {
        super();
    }
}

export class ENDElement extends ENDNode {
    type = 'ENDElement';
    constructor(readonly name: Identifier, readonly attributes: ENDAttribute[], readonly body: ENDStatement[] = []) {
        super();
    }
}

export class ENDAttribute extends ENDNode {
    type = 'ENDAttribute';
    constructor(readonly name: ENDAttributeName, readonly value: ENDAttributeValue) {
        super();
        if (name.loc && value.loc) {
            this.loc = {
                start: name.loc.start,
                end: value ? value.loc.end : name.loc.end
            };
        }
    }
}

export class ENDAttributeValueExpression extends ENDNode {
    type = 'ENDAttributeValueExpression';
    constructor(readonly elements: ENDBaseAttributeValue[] = []) {
        super();
    }
}

export class ENDVariable extends ENDNode {
    type = 'ENDVariable';
    constructor(readonly name: ENDAttributeName, readonly value: ENDAttributeValue) {
        super();
        if (name.loc && value.loc) {
            this.loc = {
                start: name.loc.start,
                end: value ? value.loc.end : name.loc.end
            };
        }
    }
}

export class ENDEvent extends ENDNode {
    type = 'ENDEvent';
    constructor(readonly name: Identifier, readonly handler: Program) {
        super();
    }
}

export class ENDIfStatement extends ENDNode {
    type = 'ENDIfStatement';
    consequent: ENDStatement[];
    constructor(readonly test: ENDAttributeValue) {
        super();
        this.consequent = [];
    }
}

export class ENDChooseStatement extends ENDNode {
    type = 'ENDChooseStatement';
    cases: ENDChooseCase[];
    constructor() {
        super();
        this.cases = [];
    }
}

export class ENDChooseCase extends ENDNode {
    type = 'ENDSwitchCase';
    consequent: ENDStatement[];
    constructor(readonly test: ENDAttributeValue = null) {
        super();
        this.consequent = [];
    }
}

export class ENDForEachStatement extends ENDNode {
    type = 'ENDForEachStatement';
    readonly body: ENDStatement[];
    constructor(readonly select: ENDAttributeValue) {
        super();
        this.body = [];
    }
}

export class ENDPartialStatement extends ENDNode {
    type = 'ENDForEachStatement';
    constructor(readonly id: Identifier, readonly params: ENDAttribute[]) {
        super();
    }
}

export class ENDVariableStatement extends ENDNode {
    type = 'ENDVariableStatement';
    variables: ENDVariable[]
    constructor() {
        super();
        this.variables = [];
    }
}

export class ENDAttributeStatement extends ENDNode {
    type = 'ENDAttributeStatement';
    attributes: ENDAttribute[];
    test: Expression | null;
    constructor() {
        super();
        this.attributes = [];
    }
}

export class ENDAddClassStatement extends ENDNode {
    type = 'ENDAddClassStatement';
    tokens: ENDPlainStatement[];
    constructor() {
        super();
        this.tokens = [];
    }
}

export class ENDText extends ENDNode {
    type = 'ENDText';
    constructor(readonly value: string) {
        super();
    }
}

export class ParsedTag extends Node {
    name: Identifier;
    constructor(name: Identifier, readonly type: 'open' | 'close', readonly attributes: ENDAttribute[] | null = null, readonly selfClosing: boolean = false) {
        super();
        this.name = name;
    }

    /**
     * Returns name of current tag
     */
    getName(): string {
        return this.name.name;
    }
}
