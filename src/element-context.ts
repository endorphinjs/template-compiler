import { ENDElement } from "@endorphinjs/template-parser";
import { SymbolGenerator } from "./symbol-generator";
import Entity from "./entity";
import { tagToJS } from "./utils";

type NamespaceList = { [prefix: string]: string };

/**
 * Contains data about element context
 */
export default class ElementContext {
    /** List of namespaces in current element */
    namespaces: NamespaceList;

    /** Indicates that given element is a component */
    readonly isComponent: boolean;

    /** Pointer to parent element context */
    parent?: ElementContext;

    readonly entities: Entity[] = [];
    private _injector: string;
    private _ref: string;

    constructor(readonly node: ENDElement, private generator: SymbolGenerator) {
        this.isComponent = this.name.includes('-');
        this.namespaces = collectNamespaces(node);
    }

    /** Name of current element */
    get name(): string {
        return this.node.name.name;
    }

    /** Symbol for referencing element */
    get ref(): string {
        return this._ref || (this._ref = this.generator(tagToJS(this.name)));
    }

    /** Symbol for referencing element’s injector */
    get injector(): string {
        return this._injector || (this._injector = this.generator('inj'));
    }

    /** Indicates that element context should use injector to operate */
    get usesInjector(): boolean {
        return this._injector != null;
    }
}

/**
 * Collects namespaces registered in given element
 */
function collectNamespaces(elem: ENDElement): NamespaceList {
    const result = {};
    elem.attributes.forEach(attr => {
        if (attr.name.type === 'Identifier') {
            const parts = String(attr.name.name).split(':');
            const prefix = parts.shift();

            if (prefix === 'xmlns' && attr.value.type === 'Literal') {
                result[parts.join(':')] = String(attr.value.value);
            }
        }
    });

    return result;
}
