import { ENDAttribute, ENDAttributeName, ENDAttributeValue, Literal, Program } from "@endorphinjs/template-parser";
import { SourceNode } from "source-map";
import Entity from "./entity";
import compileExpression from "../expression";
import CompileState from "../compile-state";
import { Chunk } from "../types";
import { isIdentifier, isExpression, sn, qStr, isLiteral } from "../utils";

export default class AttributeEntity extends Entity {
    constructor(node: ENDAttribute, state: CompileState) {
        super(isIdentifier(node.name) ? `${node.name.name}Attr` : 'exprAttr', state);
        const { element } = state;
        const isDynamic = element.isDynamicAttribute(node) || element.isComponent;
        const ns = getAttributeNS(node, state);

        if (!isDynamic && !isExpression(node.value)) {
            // Attribute with literal value: set only once, no need to update
            return this.setMount(() => {
                return ns
                    ? sn([element.getSymbol(), `.setAttributeNS(${state.namespace(ns.ns)}, `, attrName(node, state), ', ', attrValue(node, state), `)`], node)
                    : sn([element.getSymbol(), `.setAttribute(`, attrName(node, state), ', ', attrValue(node, state), `)`], node);
            });
        }

        // Generate attribute which should be updated in runtime.
        // We should generate fragments in shared state since expression will
        // be used both in mount and update state, but will attach same code in
        // separate `mount` and `update` contexts to properly use symbol references
        const name = state.shared(() => attrName(node, state));
        const value = state.shared(() => attrValue(node, state));
        if (ns) {
            this.setMount(() => sn([`${state.runtime('setAttributeNS')}(`, element.injector, `, ${state.namespace(ns.ns)}, `, name, ', ', value, `)`]));
            this.setUpdate(() => sn([`${state.runtime('setAttributeNS')}(`, element.injector, `, ${state.namespace(ns.ns)}, `, name, ', ', value, `)`]));
        } else {
            this.setMount(() => sn([element.getSymbol(), `.setAttribute(`, name, ', ', value, `)`], node));
            this.setUpdate(() => sn([element.getSymbol(), `.setAttribute(`, name, ', ', value, `)`], node));
        }
    }
}

function attrName(attr: ENDAttribute, state: CompileState): Chunk {
    const ns = getAttributeNS(attr, state);
    return compileAttributeName(ns ? ns.name : attr.name, state);
}

function attrValue(attr: ENDAttribute, state: CompileState): Chunk {
    const { element } = state.blockContext;
    const inComponent = element.node.type === 'ENDElement' && state.isComponent(element.node);
    return compileAttributeValue(attr.value, state, inComponent);
}


export function compileAttributeName(name: ENDAttributeName | string, state: CompileState): Chunk {
    if (typeof name === 'string') {
        return qStr(name);
    }

    return isExpression(name) ? compileExpression(name, state) : qStr(name.name);
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

    if (isExpression(value)) {
        // Dynamic expression, must be compiled to function
        return compileExpression(value, state);
    }

    if (value.type === 'ENDAttributeValueExpression') {
        // List of static and dynamic tokens, must be compiled to function
        const fnName = createConcatFunction('attrValue', state, value.elements);
        return `${fnName}(${state.host}, ${state.scope})`;
    }
}

export function createConcatFunction(prefix: string, state: CompileState, tokens: Array<string | Literal | Program>): string {
    return state.runBlock(prefix, () => {
        return new Entity('concat', state)
            .setMount(() => {
                const body = new SourceNode();

                body.add('return ');
                tokens.forEach((token, i) => {
                    if (i !== 0) {
                        body.add(' + ');
                    }

                    if (typeof token === 'string') {
                        body.add(qStr(token));
                    } else if (isLiteral(token)) {
                        body.add(qStr(token.value as string));
                    } else {
                        body.add(['(', compileExpression(token, state), ')']);
                    }
                });
                body.add(';');
                return body;
            });
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
