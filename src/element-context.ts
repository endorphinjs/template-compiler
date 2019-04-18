import { ENDElement, ENDTemplate, Node } from "@endorphinjs/template-parser";
import { SymbolGenerator } from "./symbol-generator";
import Entity from "./entity";
import { usageStats } from "./utils";

/**
 * Contains data about element context
 */
export default class ElementContext {
    readonly entities: Entity[] = [];
    private _injector: string;

    /** Injector usage stats in different contexts */
    readonly usage = usageStats();

    constructor(readonly node: ENDElement | ENDTemplate, readonly entity: Entity, private generator: SymbolGenerator) {}

    /** Symbol for referencing element */
    get symbol(): string {
        return this.entity.symbol;
    }

    /** Symbol for referencing element’s injector */
    get injector(): string {
        return this._injector || (this._injector = this.generator('inj'));
    }

    /** Indicates that element context should use injector to operate */
    get usesInjector(): boolean {
        return this._injector != null;
    }

    /** Indicates that current element is a component */
    get isComponent(): boolean {
        return isElement(this.node) && this.node.component;
    }
}

/**
 * Check if given AST node is element
 */
function isElement(node: Node): node is ENDElement {
    return node.type === 'ENDElement';
}
