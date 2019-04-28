import * as Ast from '@endorphinjs/template-parser';
import CompileState from './assets/CompileState';
import Entity, { entity } from './assets/Entity';
import ElementEntity, { createElement } from './assets/ElementEntity';
import AttributeEntity, { compileAttributeValue } from './assets/AttributeEntity';
import TextEntity from './assets/TextEntity';
import ConditionEntity from './assets/ConditionEntity';
import IteratorEntity from './assets/IteratorEntity';
import InnerHTMLEntity from './assets/InnerHTMLEntity';
import { sn, qStr, isLiteral, isIdentifier, isExpression, propSetter, getAttrValue, nameToJS, runtime } from './utils';
import { Chunk } from './types';
import { toObjectLiteral } from './assets/object';

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
                element.add(refEntity(node.ref, element, state));
            }

            let attrs = node.attributes;
            if (element.isComponent) {
                // In component, static attributes/props (e.g. ones which won’t change
                // in runtime) must be added during component mount. Thus, we should
                // process dynamic attributes only
                attrs = attrs.filter(attr => isDynamicAttribute(attr, state));
            }

            element.setContent(attrs, next);

            // TODO set directives

            const firstChild = node.body[0];
            if (node.name.name === 'slot') {
                // Default slot content must be generated as child block
                // to mount it only if there’s no incoming slot content
                const slotName = String(getAttrValue(node, 'name') || '');
                const contentArg = defaultSlot(node, state, next);
                element.add(entity('slotMount', state, {
                    mount: () => runtime('mountSlot', [state.host, qStr(slotName), element.getSymbol(), contentArg], state),
                    unmount: slot => runtime('unmountSlot', [slot.getSymbol()], state)
                }));
            } else if (!element.isComponent && node.body.length === 1 && isLiteral(firstChild)) {
                // Edge case: element with single text child
                element.setMount(() => createElement(node, state, firstChild));
            } else {
                element.setMount(() => createElement(node, state));
                element.setContent(node.body, next);
            }

            if (element.isComponent) {
                // Add code to mount, update and unmount component
                element.add(entity('component', state, {
                    mount: () => {
                        const staticProps = collectStaticProps(node, state);
                        const staticPropsArg = staticProps.size
                            ? toObjectLiteral(staticProps, state, 1) : null;
                        return runtime('mountComponent', [element.getSymbol(), staticPropsArg], state);
                    },
                    update: () => runtime('updateComponent', [element.getSymbol()], state),
                    unmount: () => runtime('unmountComponent', [element.getSymbol()], state)
                }))
            }
        });
    },

    ENDAttribute(attr: Ast.ENDAttribute, state) {
        return new AttributeEntity(attr, state);
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
    }
} as AstVisitorMap;

/**
 * Creates element ref entity
 */
function refEntity(ref: string, element: ElementEntity, state: CompileState): Entity {
    return entity('ref', state, {
        shared: () => runtime('setRef', [state.host, ref, element.getSymbol()], state)
    });
}

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

    return entity('store', state, {
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
 * Check if given attribute is dynamic, e.g. it’s value will be changed in runtime
 */
function isDynamicAttribute(attr: Ast.ENDAttribute, state: CompileState): boolean {
    const { element } = state;
    if (!element || !element.node || element.hasPartials || element.attributeExpressions) {
        // * no element context
        // * in child block context
        // * element contains entities which may affect any attribute
        return true;
    }

    if (isIdentifier(attr.name)) {
        return element.dynamicAttributes.has(attr.name.name);
    }

    return isExpression(attr.name)
        || isExpression(attr.value)
        || attr.value && attr.value.type === 'ENDAttributeValueExpression';
}

function collectStaticProps(elem: Ast.ENDElement, state: CompileState): Map<Chunk, Chunk> {
    const attrs: Map<Chunk, Chunk> = new Map();

    elem.attributes.forEach(attr => {
        if (!isDynamicAttribute(attr, state)) {
            attrs.set(propSetter(attr.name, state), compileAttributeValue(attr.value, state, true));
        }
    });

    elem.directives.forEach(dir => {
        if (dir.prefix === 'partial') {
            const value = compileAttributeValue(dir.value, state, true);
            attrs.set(
                qStr(`${dir.prefix}:${dir.name}`),
                runtime('assign', [`{ ${state.host} }`, sn([`${state.partials}[`, value, ']'])], state)
            );
        }
    });

    return attrs;
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
