import * as Ast from '@endorphinjs/template-parser';
import { SourceNode } from 'source-map';
import { ChunkList } from './types';
import generateExpression from './expression';
import CompileState from './assets/CompileState';
import Entity, { entity } from './assets/Entity';
import { createElement } from './assets/ElementEntity';
import AttributeEntity from './assets/AttributeEntity';
import TextEntity from './assets/TextEntity';
import ConditionEntity from './assets/ConditionEntity';
import IteratorEntity from './assets/IteratorEntity';
import InnerHTMLEntity from './assets/InnerHTMLEntity';
import generateObject from './assets/object';
import { sn, qStr, isLiteral, getAttrValue, nameToJS, runtime, propGetter, unmount } from './utils';
import VariableEntity from './assets/VariableEntity';
import EventEntity from './assets/EventEntity';

export type AstContinue = (node: Ast.Node) => Entity | void;
export type AstVisitor = (node: Ast.Node, state: CompileState, next: AstContinue) => Entity | void;
export type AstVisitorMap = { [name: string]: AstVisitor };

export default {
    ENDTemplate(node: Ast.ENDTemplate, state, next) {
        state.runBlock('template', block => {
            block.exports = 'default';

            return state.runElement(node, element => {
                element.setMount(() => `${state.host}.componentView`);
                element.setContent(node.body, next);

                if (state.usedStore.size) {
                    element.add(subscribeStore(state));
                }

                if (state.usedRuntime.has('setRef') || state.usedRuntime.has('mountPartial')) {
                    // Template sets refs or contains partials which may set
                    // refs as well
                    element.add(entity('refs', state, {
                        shared: () => runtime('finalizeRefs', [state.host], state)
                    }));
                }
            });
        });
    },

    ENDElement(node: Ast.ENDElement, state, next) {
        return state.runElement(node, element => {
            if (node.ref) {
                element.setRef(node.ref);
            }

            let attrs = node.attributes;
            if (element.isComponent) {
                // In component, static attributes/props (e.g. ones which won’t change
                // in runtime) must be added during component mount. Thus, we should
                // process dynamic attributes only
                attrs = attrs.filter(attr => element.isDynamicAttribute(attr));
            }

            element.setContent(attrs, next);
            element.setContent(node.directives, next);

            const firstChild = node.body[0];
            if (node.name.name === 'slot') {
                // Default slot content must be generated as child block
                // to mount it only if there’s no incoming slot content
                const slotName = String(getAttrValue(node, 'name') || '');
                const contentArg = defaultSlot(node, state, next);
                element.add(state.entity({
                    mount: () => runtime('mountSlot', [state.host, qStr(slotName), element.getSymbol(), contentArg], state),
                    unmount: slot => unmount('unmountSlot', slot.getSymbol(), state)
                }));
            } else if (!element.isComponent && node.body.length === 1 && isLiteral(firstChild)) {
                // Edge case: element with single text child
                element.setMount(() => createElement(node, state, firstChild));
            } else {
                element.setMount(() => createElement(node, state));
                element.setContent(node.body, next);
            }

            if (element.isComponent) {
                element.markSlots();
                element.mountComponent();
            } else {
                if (element.dynamicAttributes.size || element.hasPartials) {
                    element.finalizeAttributes();
                }

                if (element.dynamicEvents.size || element.hasPartials) {
                    element.finalizeEvents();
                }
            }

            element.animate();
        });
    },

    ENDAttributeStatement(node: Ast.ENDAttributeStatement, state, next) {
        return entity('block', state)
            .setContent(node.attributes, next)
            .setContent(node.directives, next);
    },

    ENDAttribute(attr: Ast.ENDAttribute, state) {
        return new AttributeEntity(attr, state);
    },

    ENDDirective(dir: Ast.ENDDirective, state) {
        if (dir.prefix === 'on') {
            return new EventEntity(dir, state);
        }
    },

    ENDAddClassStatement(node: Ast.ENDAddClassStatement, state, next) {
        const block = entity('block', state);

        block.setMount(() => mountAddClass(node, state));
        if (state.element && state.element.node) {
            // Running inside element
            block.setUpdate(() => mountAddClass(node, state));
        }

        return block;
    },

    Literal(node: Ast.Literal, state) {
        if (node.value != null) {
            return new TextEntity(node, state);
        }
    },

    // NB `Program` is used as expression for text node
    Program(node: Ast.Program, state) {
        return new TextEntity(node, state);
    },

    ENDIfStatement(node: Ast.ENDIfStatement, state, next) {
        const entity = new ConditionEntity(node, state);
        if (node.consequent.every(isSimpleConditionContent)) {
            entity.setSimple(node.test, node.consequent, next);
        } else {
            entity.setContent([node], next);
        }
        return entity;
    },

    ENDChooseStatement(node: Ast.ENDChooseStatement, state, next) {
        return new ConditionEntity(node, state)
            .setContent(node.cases, next);
    },

    ENDForEachStatement(node: Ast.ENDForEachStatement, state, next) {
        return new IteratorEntity(node, state)
            .setContent(node.body, next);
    },

    ENDInnerHTML(node: Ast.ENDInnerHTML, state) {
        return new InnerHTMLEntity(node, state);
    },

    ENDVariableStatement(node: Ast.ENDVariableStatement, state) {
        return new VariableEntity(node, state);
    },

    ENDPartial(node: Ast.ENDPartial, state, next) {
        const name = state.runChildBlock(`partial${nameToJS(node.id, true)}`, (block, elem) => {
            elem.setContent(node.body, next);
        });

        state.partialsMap.set(node.id, {
            name,
            defaults: generateObject(node.params, state, 2)
        });
    },

    ENDPartialStatement(node: Ast.ENDPartialStatement, state) {
        const getter = `${state.host}.props['partial:${node.id}'] || ${state.partials}${propGetter(node.id)}`;

        return entity('partial', state, {
            mount: () => runtime('mountPartial', [state.host, state.injector, getter, generateObject(node.params, state, 1)], state),
            update: ent => runtime('updatePartial', [ent.getSymbol(), getter, generateObject(node.params, state, 1)], state),
            unmount: ent => unmount('unmountPartial', ent.getSymbol(), state)
        });
    }
} as AstVisitorMap;

/**
 * Returns code for subscribing to store updates
 * @param state
 */
function subscribeStore(state: CompileState): Entity {
    // Without partials, we can safely assume that we know about
    // all used store keys
    const storeKeysArg = state.hasPartials
        ? `[${Array.from(state.usedStore).map(qStr).join(', ')}]`
        : '';

    return state.entity({
        mount: () => runtime('subscribeStore', [state.host, storeKeysArg], state)
    });
}

function isSimpleConditionContent(node: Ast.ENDStatement): boolean {
    if (node.type === 'ENDAttributeStatement') {
        return node.directives.filter(dir => dir.prefix === 'on').length === 0;
    }

    return node.type === 'ENDAddClassStatement';
}

/**
 * Generates function with default content of given slot. If slot is empty,
 * no function is generated
 */
function defaultSlot(node: Ast.ENDElement, state: CompileState, next: AstContinue): string | null {
    const slotName = String(getAttrValue(node, 'name') || '');
    return node.body.length
        ? state.runChildBlock(`slot${nameToJS(slotName, true)}`,
            (child, slot) => slot.setContent(node.body, next))
        : null;
}

function mountAddClass(node: Ast.ENDAddClassStatement, state: CompileState): SourceNode {
    const chunks: ChunkList = node.tokens.map(token => {
        return isLiteral(token)
            ? qStr(token.value as string)
            : generateExpression(token, state);
    });
    return runtime('addClass', [state.injector, sn(chunks).join(' + ')], state, node);
}
