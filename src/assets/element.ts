import { ENDElement, Literal } from "@endorphinjs/template-parser";
import CompileState from "../compile-state";
import { getControlName, sn, qStr } from "../utils";
import { Chunk } from "../types";

/**
 * Generates element create code
 */
export function createElement(node: ENDElement, state: CompileState, text?: Literal): Chunk {
    const elemName = node.name.name;
    const srcNode = node.name;

    if (getControlName(elemName) === 'self') {
        // Create component which points to itself
        return sn([`${state.runtime('createComponent')}(${state.host}.nodeName, ${state.host}).componentModel.definition, ${state.host})`], srcNode);
    }

    if (state.isComponent(node)) {
        // Create component
        return sn([`${state.runtime('createComponent')}(${qStr(elemName)}, ${state.getComponent(node)}, ${state.host})`], srcNode);
    }

    // Create plain DOM element
    const nodeName = getNodeName(elemName);
    const nsSymbol = state.namespace(nodeName.ns);

    if (text) {
        const textValue = qStr(text.value as string);
        return nsSymbol
            ? sn(`${state.runtime('elemNSWithText')}(${qStr(nodeName.name)}, ${textValue}, ${nsSymbol}${cssScopeArg(state)})`, srcNode)
            : sn(`${state.runtime('elemWithText')}(${qStr(elemName)}, ${textValue}${cssScopeArg(state)})`, srcNode);
    }

    return nsSymbol
        ? sn(`${state.runtime('elemNS')}(${qStr(nodeName.name)}, ${nsSymbol}${cssScopeArg(state)})`, srcNode)
        : sn(`${state.runtime('elem')}(${qStr(elemName)}${cssScopeArg(state)})`, srcNode);
}

function cssScopeArg(state: CompileState): string {
    return state.options.cssScope ? `, ${state.cssScopeSymbol}` : '';
}

function getNodeName(localName: string): { ns?: string, name: string } {
    const parts = localName.split(':');
    let ns: string, name: string;
    if (parts.length > 1) {
        ns = parts.shift();
        name = parts.join(':');
    } else {
        name = localName;
    }

    return { ns, name };
}
