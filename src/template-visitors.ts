import * as Ast from '@endorphinjs/template-parser';
import Entity from './entity';
import CompileState from './compile-state';
import { flatten, sn, isLiteral, qStr } from './utils';
import { createElement } from './assets/element';
import { attributeEntity } from './assets/attribute';
import generateExpression from './expression';
import { Chunk } from './types';
import { conditionEntity } from './assets/condition';

export type AstContinue = (node: Ast.Node) => Entity | Entity[] | void;
export type AstVisitor = (node: Ast.Node, state: CompileState, next: AstContinue) => Entity | Entity[] | void;
export type AstVisitorMap = { [name: string]: AstVisitor };

export default {
    ENDTemplate(node: Ast.ENDTemplate, state, next) {
        const name = state.runBlock('template', () => {
            return state.runElement(node, (ctx, entity) => {
                const entities = flatten(node.body.map(next)) as Entity[];

                if (ctx.usesInjector) {
                    entities.unshift(ctx.createInjector());
                }

                // Attach created entities
                ctx.attachEntities(entities);

                entity.mount(() => sn([entity.createVar(), `${state.host}.componentView;`]));

                if (state.usedStore.size) {
                    entity.push(subscribeStore(state));
                }

                return entities;
            });
        });
        state.pushOutput(`\nexport default ${name};`);
    },

    ENDElement(node: Ast.ENDElement, state, next) {
        return state.runElement(node, (ctx, entity) => {
            // Edge case: element with single text child
            const firstChild = node.body[0];
            if (!state.isComponent(node) && node.body.length === 1 && isLiteral(firstChild)) {
                entity.mount(() => createElement(node, state, firstChild));
            } else {
                entity.mount(() => createElement(node, state));

                // Generate contents
                const entities = flatten(
                    node.ref && refEntity(node.ref, state),
                    node.attributes.map(next),
                    flatten(node.body.map(next))
                ) as Entity[];

                if (ctx.usesInjector) {
                    entities.unshift(ctx.createInjector());
                }

                // Attach created entities
                ctx.attachEntities(entities);

                if (node.component) {
                    // TODO Mount component
                }

                return entities;
            }
        });
    },

    ENDAttribute(attr: Ast.ENDAttribute, state) {
        const { element } = state.blockContext;
        const inComponent = element.node.type === 'ENDElement' && state.isComponent(element.node);

        // Dynamic attributes must be handled by runtime and re-rendered on update
        const isDynamic = element.isDynamicAttribute(attr) || inComponent;

        return attributeEntity(attr, state, isDynamic);
    },

    Literal(node: Ast.Literal, state) {
        if (node.value != null) {
            return state.entity('text')
                .mount(() => sn(`${state.runtime('text')}(${qStr(node.value as string)})`, node));
        }
    },

    Program(node: Ast.Program, state) {
        // NB `Program` is used as expression for text node
        const expr = state.shared(() => generateExpression(node, state));
        return state.entity('text')
            .mount(() => sn([`${state.runtime('text')}(`, expr, ')'], node))
            .update(entity => sn([`${state.runtime('updateText')}(${entity.symbol}, `, expr, ');'], node));
    },

    ENDIfStatement(node: Ast.ENDIfStatement, state, next) {
        return conditionEntity(node, state, next);
    },

    ENDChooseStatement(node: Ast.ENDChooseStatement, state, next) {
        return conditionEntity(node, state, next);
    }
} as AstVisitorMap;

/**
 * Creates element ref entity
 */
function refEntity(ref: string, state: CompileState): Entity {
    return state.entity('block', 'ref')
        .shared(() => sn([`${state.runtime('setRef')}(${state.host}, `, ref, `, ${state.element});`]));
}

/**
 * Returns code for subscribing to store updates
 * @param state
 */
function subscribeStore(state: CompileState): Chunk {
    let storeKeys = '';

    // Without partials, we can safely assume that we know about
    // all used store keys
    if (!state.hasPartials) {
        storeKeys = `, [${Array.from(state.usedStore).map(qStr).join(', ')}]`;
    }

    return `${state.runtime('subscribeStore')}(${state.host}${storeKeys});`;
}
