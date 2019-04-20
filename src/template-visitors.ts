import * as Ast from '@endorphinjs/template-parser';
import Entity from './entity';
import CompileState from './compile-state';
import { flatten, sn, isLiteral, qStr } from './utils';
import ElementContext from './element-context';
import { SourceNode } from 'source-map';
import { createElement } from './assets/element';
import { attributeEntity } from './assets/attribute';
import generateExpression from './expression';
import { UsageStats, Chunk } from './types';

export type AstContinue = (node: Ast.Node) => Entity | Entity[] | void;
export type AstVisitor = (node: Ast.Node, state: CompileState, next: AstContinue) => Entity | Entity[] | void;
export type AstVisitorMap = { [name: string]: AstVisitor };

export default {
    ENDTemplate(node: Ast.ENDTemplate, state, next) {
        const name = state.runBlock('template', () => {
            return state.runElement(node, (ctx, entity) => {
                const injector = ctx.usesInjector;
                const entities = flatten(
                    injector && createInjector(entity.symbol, ctx, state),
                    node.body.map(next),
                ) as Entity[];

                attachEntities(entity, entities, state, injector);

                entity.mount(() => sn([createEntityVar(entity, state), `${state.host}.componentView;`]));

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
                const injector = ctx.usesInjector;
                const entities = flatten(
                    injector && createInjector(entity.symbol, ctx, state),
                    node.ref && refEntity(node.ref, state),
                    node.attributes.map(next),
                    flatten(node.body.map(next))
                ) as Entity[];

                // Attach created entities
                attachEntities(entity, entities, state, injector);

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
    }
} as AstVisitorMap;

function attachEntities(entity: Entity, children: Entity[], state: CompileState, useInjector?: boolean) {
    children.forEach(childEntity => {
        if (childEntity.mountCode) {
            let insert: SourceNode;
            if (childEntity.type === 'element' || childEntity.type === 'text') {
                // Attach child element
                insert = useInjector
                    ? sn([`${state.runtime('insert')}(${state.injector}, `, childEntity.mountCode, `);`])
                    : sn([`${entity.symbol}.appendChild(`, childEntity.mountCode, `);`]);
            }
            else {
                insert = sn(childEntity.mountCode);
            }
            // Do we need entity reference?
            insert.prepend(createEntityVar(childEntity, state));
            entity.push(insert);
            childEntity.mountCode = null;
        }

        entity.push(childEntity.content);
        childEntity.content.length = 0;
    });
}

/**
 * Creates injector entity
 */
function createInjector(symbol: string, ctx: ElementContext, state: CompileState): Entity {
    const injector = state.entity('block', ctx.injector);

    injector.mount(() => sn([
        createVar(ctx.injector, ctx.usage, state),
        `${state.runtime('createInjector')}(${symbol});`
    ]));

    if (ctx.usage.update || ctx.usage.unmount) {
        injector.unmount(() => `${state.scope}.${ctx.injector} = null;`);
    }

    return injector;
}

/**
 * Returns code for referencing entity by symbol depending on its usage stats
 */
function createVar(symbol: Entity | string, usage: UsageStats, state: CompileState): string {
    let result = '';

    if (usage.mount) {
        result += `const ${symbol} = `;
    }

    if (usage.update || usage.unmount) {
        result += `${state.scope}.${symbol} = `;
    }

    return result;
}

/**
 * Returns code for referencing entity depending on its usage stats
 */
function createEntityVar(entity: Entity, state: CompileState): string {
    return createVar(entity, entity.usage, state);
}

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
