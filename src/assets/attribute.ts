import { SourceNode } from "source-map";
import compileExpression from "../expression";
import { qStr, isLiteral, isIdentifier } from "../utils";
import { ENDAttributeName, ENDAttributeValue, Program, ENDAttribute } from "@endorphinjs/template-parser";
import CompileState from "../compile-state";
import { Chunk } from "../types";

export function compileAttributeName(name: ENDAttributeName | string, state: CompileState): Chunk {
    if (typeof name === 'string') {
        return qStr(name);
    }

    return name.type === 'Program'
        ? compileExpression(name, state)
        : qStr(name.name);
}

export function compileAttributeValue(value: ENDAttributeValue, state: CompileState, forComponent?: boolean): Chunk {
    if (value === null) {
        // Static boolean attribute
        return forComponent ? 'true' : qStr('');
    }

    if (isLiteral(value)) {
        // Static string attribute
        if (forComponent && typeof value.value !== 'string') {
            return String(value.value);
        }

        return qStr(String(value.value != null ? value.value : ''));
    }

    if (value.type === 'Program') {
        // Dynamic expression, must be compiled to function
        return compileExpression(value, state);
    }

    if (value.type === 'ENDAttributeValueExpression') {
        // List of static and dynamic tokens, must be compiled to function
        const fnName = createConcatFunction('attrValue', state,
            value.elements.map(elem => isLiteral(elem) ? String(elem.value) : elem))
        return `${fnName}(${state.host}, ${state.scope})`;
    }
}

export function createConcatFunction(prefix: string, state: CompileState, tokens: Array<string | Program>): string {
    return state.block(prefix, () => {
        const entity = state.entity('block');
        const body = entity.mount = new SourceNode();

        body.add('return ');
        tokens.forEach((token, i) => {
            if (i !== 0) {
                body.add(' + ');
            }

            if (typeof token === 'string') {
                body.add(qStr(token));
            } else {
                body.add(['(', compileExpression(token, state), ')']);
            }
        });
        body.add(';');

        return [entity];
    });
}

/**
 * Returns namespace URI for given attribute, if available
 */
export function getAttributeNS(attr: ENDAttribute, state: CompileState): { name: string, ns: string } | void {
    if (isIdentifier(attr.name)) {
        const parts = String(attr.name.name).split(':');
        if (parts.length > 1 && parts[0] !== 'xmlns') {
            // It’s a namespaced attribute, find it’s URI
            const ns = state.namespace(parts.shift());

            if (ns) {
                return { ns, name: parts.join(':') };
            }
        }
    }
}
