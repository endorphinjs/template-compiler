import { ENDElement, Literal } from "@endorphinjs/template-parser";
import ElementContext from "../element-context";
import Entity from "../entity";
import CompileState from "../compile-state";
import { Builder, BuilderContext } from "../builder";
import { Chunk, getControlName, sn, qStr } from "../utils";

/**
 * Element entity factory
 */
export default function createElementEntity(elemCtx: ElementContext, state: CompileState): Entity {
    // Render child entities to collect stats about element content
    const { entities } = elemCtx;
    const rendered = entities.map(entity => entity.render(state, elemCtx));

    const create: Builder = ctx => {

    };
}

function assertRegisteredComponent(elemCtx: ElementContext, state: CompileState): boolean {
    const { name } = elemCtx;
    const data = state.componentsMap.get(name);

    if (data) {
        return data.used = true;
    }

    if (elemCtx.isComponent) {
        state.warnOnce(name, `Missing component definition for <${name}>, did you forgot to <link rel="import"> it?`, elemCtx.node.loc.start.offset);
    }

    return false;
}

/**
 * Check if given element is a special simple case with single text content.
 * If so, returns this text value
 * @param elem
 */
function singleText(elem: ENDElement): string | null {
    if (elem.body.length === 1 && elem.body[0].type === 'Literal') {
        const text = elem.body[0] as Literal;
        return text.value != null && String(text.value);
    }
}

/**
 * Generates element create code
 */
function createElement(node: ENDElement, ctx: BuilderContext): Chunk {
    const elemName = node.name.name;
    const { state } = ctx;
    const srcNode = node.name;

    if (getControlName(elemName) === 'self') {
        // Create component which points to itself
        return sn([`${state.runtime('createComponent')}(${ctx.host}.nodeName, ${ctx.host}).componentModel.definition, ${ctx.host})`], srcNode);
    }

    if (node.component) {
        // Create component
        return sn([`${state.runtime('createComponent')}(${qStr(elemName)}, ${state.componentsMap.get(elemName).symbol}, ${ctx.host})`], srcNode);
    }

    // Create plain DOM element
    if (state.namespace) {
        return sn(`${state.runtime('elemNS')}(${qStr(elemName)}, ${state.namespace}${cssScopeArg(state)})`, srcNode);
    }

    return sn(`${state.runtime('elem')}(${qStr(elemName)}${cssScopeArg(state)})`, srcNode);
}

function cssScopeArg(state: CompileState): string {
    return state.options.cssScope ? `, ${state.cssScopeSymbol}` : '';
}
