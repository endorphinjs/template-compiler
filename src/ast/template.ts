/**
 * AST descriptors for Endorphin templates
 */

import { Node } from './base';
import { Identifier, Program, Literal } from './expression';
import { SourceNode } from 'source-map';

export type ENDStatement = ENDElement | ENDInnerHTML | ENDPlainStatement | ENDAttributeStatement | ENDAddClassStatement | ENDVariableStatement | ENDControlStatement | ENDPartialStatement;
export type ENDProgramStatement = ENDTemplate | ENDPartial | ENDImport | ENDStatement;
export type ENDControlStatement = ENDIfStatement | ENDChooseStatement | ENDForEachStatement | ENDPartialStatement;
export type ENDPlainStatement = ENDText | Program;
export type ENDAttributeName = Identifier | Program;
export type ENDBaseAttributeValue = Literal | Program;
export type ENDAttributeValue = ENDBaseAttributeValue | ENDAttributeValueExpression | null;

export class ENDNode extends Node {

}

export class ENDProgram extends ENDNode {
    type = 'ENDProgram';
    filename?: string;
    readonly body: ENDProgramStatement[] = [];
    readonly stylesheets: ENDStylesheet[] = [];
    readonly scripts: ENDScript[] = [];
    constructor() {
        super();
    }
}

export class ENDTemplate extends ENDNode {
    type = 'ENDTemplate';
    constructor(readonly body: ENDStatement[] = []) {
        super();
    }
}

export class ENDPartial extends ENDNode {
    type = 'ENDPartial';
    readonly body: ENDStatement[]
    constructor(readonly id: Identifier, readonly params: ENDAttribute[]) {
        super();
        this.body = [];
    }
}

export class ENDElement extends ENDNode {
    type = 'ENDElement';
    constructor(readonly name: Identifier, readonly attributes: ENDAttribute[], readonly directives: ENDDirective[], readonly body: ENDStatement[] = []) {
        super();
    }
}

export class ENDAttribute extends ENDNode {
    type = 'ENDAttribute';
    constructor(readonly name: ENDAttributeName, readonly value: ENDAttributeValue) {
        super();
        if (name.loc) {
            this.loc = {
                start: name.loc.start,
                end: value && value.loc ? value.loc.end : name.loc.end
            };
        }
    }
}

export class ENDDirective extends ENDNode {
    type = 'ENDDirective';
    constructor(readonly prefix: string, readonly name: Identifier, readonly value: ENDAttributeValue) {
        super();
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

export class ENDIfStatement extends ENDNode {
    type = 'ENDIfStatement';
    consequent: ENDStatement[];
    constructor(readonly test: Program) {
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
    type = 'ENDChooseCase';
    consequent: ENDStatement[];
    constructor(readonly test: Program = null) {
        super();
        this.consequent = [];
    }
}

export class ENDForEachStatement extends ENDNode {
    type = 'ENDForEachStatement';
    readonly body: ENDStatement[];
    constructor(readonly select: Program, readonly key?: Program) {
        super();
        this.body = [];
    }
}

export class ENDPartialStatement extends ENDNode {
    type = 'ENDPartialStatement';
    constructor(readonly id: Identifier, readonly params: ENDAttribute[]) {
        super();
    }
}

export class ENDVariableStatement extends ENDNode {
    type = 'ENDVariableStatement';
    constructor(readonly variables: ENDVariable[]) {
        super();
    }
}

export class ENDAttributeStatement extends ENDNode {
    type = 'ENDAttributeStatement';
    constructor(readonly attributes: ENDAttribute[], readonly directives: ENDDirective[]) {
        super();
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
    value: string;
    constructor(value: string) {
        super();
        this.value = value;
    }
}

export class ENDInnerHTML extends ENDNode {
    type = 'ENDInnerHTML';
    constructor(readonly value: Program) {
        super();
    }
}

export class ENDImport extends ENDNode {
    type = 'ENDImport';
    constructor(readonly name: string, readonly href: string) {
        super();
    }
}

export class ENDStylesheet extends ENDNode {
    type = 'ENDStylesheet';
    transformed?: SourceNode;
    constructor(readonly mime: string, readonly content?: ENDText, readonly url?: string) {
        super();
    }
}

export class ENDScript extends ENDNode {
    type = 'ENDScript';
    transformed?: SourceNode | string;
    constructor(readonly mime: string, readonly content?: ENDText, readonly url?: string) {
        super();
    }
}

export class ParsedTag extends Node {
    name: Identifier;
    attributes: ENDAttribute[];
    directives: ENDDirective[];
    constructor(name: Identifier, readonly type: 'open' | 'close', readonly selfClosing: boolean = false) {
        super();
        this.name = name;
        this.attributes = [];
        this.directives = [];
    }

    /**
     * Returns name of current tag
     */
    getName(): string {
        return this.name.name;
    }
}
