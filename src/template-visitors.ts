import * as Ast from '@endorphinjs/template-parser';
import CompileState from './compile-state';
import Entity from './assets/Entity';
import ElementEntity, { getNodeName, cssScopeArg } from './assets/ElementEntity';
import AttributeEntity from './assets/AttributeEntity';
import TextEntity from './assets/TextEntity';
import ConditionEntity from './assets/ConditionEntity';
import { sn, isLiteral, qStr } from './utils';

export type AstContinue = (node: Ast.Node) => Entity | void;
export type AstVisitor = (node: Ast.Node, state: CompileState, next: AstContinue) => Entity | void;
export type AstVisitorMap = { [name: string]: AstVisitor };

export default {
    ENDTemplate(node: Ast.ENDTemplate, state, next) {
        const name = state.runBlock('template', () => {
            return state.runElement(node, element => {
                element.setContent(node.body, next);

                if (state.usedStore.size) {
                    element.add(subscribeStore(state));
                }
            });
        });
        state.pushOutput(`\nexport default ${name};`);
    },

    ENDElement(node: Ast.ENDElement, state, next) {
        return state.runElement(node, element => {
            if (node.ref) {
                element.add(refEntity(node.ref, element, state));
            }

            // Edge case: element with single text child
            const firstChild = node.body[0];
            if (!state.isComponent(node) && node.body.length === 1 && isLiteral(firstChild)) {
                element.setMount(() => {
                    // Create plain DOM element
                    const nodeName = getNodeName(element.rawName);
                    const nsSymbol = state.namespace(nodeName.ns);

                    const textValue = qStr(firstChild.value as string);
                    return nsSymbol
                        ? sn(`${state.runtime('elemNSWithText')}(${qStr(nodeName.name)}, ${textValue}, ${nsSymbol}${cssScopeArg(state)})`, element.node)
                        : sn(`${state.runtime('elemWithText')}(${qStr(element.rawName)}, ${textValue}${cssScopeArg(state)})`, element.node);
                });
            } else {
                element.setContent(node.attributes, next);
                element.setContent(node.body, next);

                if (node.component) {
                    // TODO Mount component
                }
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

    Program(node: Ast.Program, state) {
        // NB `Program` is used as expression for text node
        return new TextEntity(node, state);
    },

    ENDIfStatement(node: Ast.ENDIfStatement, state, next) {
        return new ConditionEntity(node, state)
            .setContent([node], next);
    },

    ENDChooseStatement(node: Ast.ENDChooseStatement, state, next) {
        return new ConditionEntity(node, state)
            .setContent(node.cases, next);
    }
} as AstVisitorMap;

/**
 * Creates element ref entity
 */
function refEntity(ref: string, element: ElementEntity, state: CompileState): Entity {
    return new Entity('ref', state)
        .setMount(() => sn([`${state.runtime('setRef')}(${state.host}, `, ref, `, `, element.getSymbol(), `);`]))
        .setUpdate(() => sn([`${state.runtime('setRef')}(${state.host}, `, ref, `, `, element.getSymbol(), `);`]));
}

/**
 * Returns code for subscribing to store updates
 * @param state
 */
function subscribeStore(state: CompileState): Entity {
    let storeKeys = '';

    // Without partials, we can safely assume that we know about
    // all used store keys
    if (!state.hasPartials) {
        storeKeys = `, [${Array.from(state.usedStore).map(qStr).join(', ')}]`;
    }

    return new Entity('store', state)
        .setMount(() => `${state.runtime('subscribeStore')}(${state.host}${storeKeys});`);
}
