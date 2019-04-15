import { ENDElement } from "@endorphinjs/template-parser";

type NamespaceList = { [prefix: string]: string };

/**
 * Contains data about element context
 */
export default class ElementContext {
    /** Indicates that element context should use injector to operate */
    useInjector = false;

    /** List of namespaces in current element */
    namespaces: NamespaceList;

    /** Indicates that given element is a component */
    readonly isComponent: boolean;

    constructor(readonly node: ENDElement) {
        this.isComponent = node.name.name.includes('-');
        this.namespaces = collectNamespaces(node);
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
