import * as Ast from '@endorphinjs/template-parser';
import { SourceNode } from 'source-map';
import CompileState from "./compile-state";
import { createElement } from './assets/element';
import Entity from './entity';
import { sn, flatten, qStr, isRef, isIdentifier } from './utils';
import { UsageStats, Chunk } from './types';
import ElementContext from './element-context';
import { compileAttributeValue, getAttributeNS, compileAttributeName } from './assets/attribute';
import { ENDAttribute } from '@endorphinjs/template-parser';

type AstContinue = (node: Ast.Node) => Entity | Entity[];
type AstVisitor = (node: Ast.Node, state: CompileState, next: AstContinue) => Entity | Entity[] | void;
type AstVisitorMap = { [name: string]: AstVisitor };

const baseVisitors = {
    ENDTemplate(node: Ast.ENDTemplate, state, next) {
        const name = state.block('template', () => {
            return state.element(node, (ctx, entity) => {
                const entities = flatten(node.body.map(next))
                    .filter(Boolean);

                entity.push(sn[createEntityRef(entity, state), `${state.host}.componentView;`]);

                if (ctx.usesInjector) {
                    entities.unshift(createInjector(entity.symbol, ctx, state));
                }

                attachEntities(entities, ctx, state, entity);

                if (state.usedStore.size) {
                    entity.push(subscribeStore(state));
                }

                return entities;
            });
        });
        state.pushOutput(`export default ${name};`);
    },

    ENDElement(node: Ast.ENDElement, state, next) {
        return state.element(node, (ctx, entity) => {
            entity.mount = createElement(node, state);

            // Generate contents
            const entities = flatten(node.attributes.map(next))
                .concat(flatten(node.body.map(next)))
                .filter(Boolean);

            // We’ve used injector for current element content: mount it
            if (ctx.usesInjector) {
                entities.unshift(createInjector(entity.symbol, ctx, state));
            }

            // Attach created entities
            attachEntities(entities, ctx, state, entity);

            if (node.component) {
                // TODO Mount component
            }

            return entities;
        });
    },

    ENDAttribute(attr: Ast.ENDAttribute, state) {
        const entity = state.entity('attribute', isIdentifier(attr.name)
            ? `${attr.name.name}Attr` : 'exprAttr');

        if (isRef(attr)) {
            // Element reference: ref="name"
            // TODO support static refs
            entity.mount = state.mount(() => ref(attr, state));
            entity.update = state.update(() => ref(attr, state));
        } else {
            const { element } = state.blockContext;
            const inComponent = element.node.type === 'ENDElement' && state.isComponent(element.node);

            // Dynamic attributes must be handled by runtime and re-rendered on update
            const isDynamic = element.isDynamicAttribute(attr) || inComponent;

            entity.mount = state.mount(() => isDynamic ? dynamicAttr(attr, state) : staticAttr(attr, state));
            entity.update = state.update(() => isDynamic ? dynamicAttr(attr, state) : staticAttr(attr, state));
        }

        return entity;
    },

    Literal(node: Ast.Literal, state) {
        if (node.value != null) {
            return state.mount(() => {
                const entity = state.entity('text');
                entity.mount = sn(`${state.runtime('text')}(${qStr(node.value as string)})`, node);
                return entity;
            });
        }
    }
} as AstVisitorMap;

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

/**
 * Creates injector entity
 */
function createInjector(symbol: string, ctx: ElementContext, state: CompileState): Entity {
    const injector = state.entity('block', ctx.injector);

    injector.mount = state.mount(() => sn([
        createRef(ctx.injector, ctx.usage, state),
        `${state.runtime('createInjector')}(${symbol});`
    ]));

    if (ctx.usage.update || ctx.usage.unmount) {
        injector.unmount = state.unmount(() => `${state.scope}.${ctx.injector} = null;`);
    }

    return injector;
}

function attachEntities(entities: Entity[], ctx: ElementContext, state: CompileState, entity: Entity) {
    entities.forEach(childEntity => {
        let insert: SourceNode;
        if (childEntity.type === 'element' || childEntity.type === 'text') {
            // Attach child element
            insert = ctx.usesInjector
                ? sn([`${state.runtime('insert')}(${ctx.injector}, `, childEntity.mount, `);`])
                : sn([`${entity.symbol}.appendChild(`, childEntity.mount, `);`]);
        }
        else {
            insert = sn(entity.mount);
        }
        // Do we need entity reference?
        insert.prepend(createEntityRef(childEntity, state));

        entity.push(insert, childEntity.fill);
        childEntity.mount = null;
        childEntity.fill.length = 0;
    });
}

/**
 * Returns code for referencing entity by symbol depending on its usage stats
 */
function createRef(symbol: string, usage: UsageStats, state: CompileState): string {
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
function createEntityRef(entity: Entity, state: CompileState): string {
    return createRef(entity.symbol, entity.usage, state);
}

function ref(attr: ENDAttribute, state: CompileState): Chunk {
    const { element } = state.blockContext;
    const refName = compileAttributeValue(attr.value, state);
    return sn([`${state.runtime('setRef')}(${state.host}, `, refName, `, ${element.symbol});`]);
}

function staticAttr(attr: ENDAttribute, state: CompileState): Chunk {
    const { element } = state.blockContext;
    const ns = getAttributeNS(attr, state);

    return ns
        ? sn([`${element.symbol}.setAttributeNS(${state.namespace(ns.ns)}, `, attrName(attr, state), ', ', attrValue(attr, state), `);`], attr)
        : sn([`${element.symbol}.setAttribute(`, attrName(attr, state), ', ', attrValue(attr, state), `);`], attr);

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
