import { SourceNode } from "source-map";
import { ENDAttributeName, ENDAttributeValue, Program, ENDAttribute, Literal } from "@endorphinjs/template-parser";
import compileExpression from "../expression";
import { qStr, isLiteral, isIdentifier, sn, isExpression } from "../utils";
import CompileState from "../compile-state";
import { Chunk } from "../types";
import Entity from "../entity";

export function attributeEntity(attr: ENDAttribute, state: CompileState, isDynamic?: boolean): Entity {
    const symbol = isIdentifier(attr.name) ? `${attr.name.name}Attr` : 'exprAttr';
    const entity = state.entity('attribute', symbol);

    if (!isDynamic && !isExpression(attr.value)) {
        // Attribute with literal value: set only once, no need to update
        return entity.mount(() => staticAttr(attr, state));
    }

    return entity.shared(() => isDynamic ? dynamicAttr(attr, state) : staticAttr(attr, state));
}

function staticAttr(attr: ENDAttribute, state: CompileState): Chunk {
    const ns = getAttributeNS(attr, state);

    return ns
        ? sn([`${state.element}.setAttributeNS(${state.namespace(ns.ns)}, `, attrName(attr, state), ', ', attrValue(attr, state), `);`], attr)
        : sn([`${state.element}.setAttribute(`, attrName(attr, state), ', ', attrValue(attr, state), `);`], attr);
}

function dynamicAttr(attr: ENDAttribute, state: CompileState): Chunk {
    const ns = getAttributeNS(attr, state);

    return ns
        ? sn([`${state.runtime('setAttributeNS')}(${state.injector}, ${state.namespace(ns.ns)}, `, attrName(attr, state), ', ', attrValue(attr, state), `);`])
        : sn([`${state.runtime('setAttribute')}(${state.injector}, `, attrName(attr, state), ', ', attrValue(attr, state), `);`], attr);
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
        return state.entity('block')
            .mount(() => {
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
