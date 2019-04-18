import * as Ast from '@endorphinjs/template-parser';
import { SourceNode } from 'source-map';
import CompileState from "./compile-state";
import { createElement } from './assets/element';
import Entity from './entity';
import { sn, flatten } from './utils';
import { UsageStats } from './types';
import ElementContext from './element-context';

type AstContinue = (node: Ast.Node) => Entity | Entity[];
type AstVisitor = (node: Ast.Node, state: CompileState, next: AstContinue) => Entity | Entity[] | void;
type AstVisitorMap = { [name: string]: AstVisitor };

const baseVisitors = {
    ENDTemplate(node: Ast.ENDTemplate, state, next) {
        const name = state.block('template', () => {
            return state.element(node, (ctx, entity) => {

                const entities = flatten(node.body.map(next))
                    .filter(Boolean);

                entity.fill.push(sn[createEntityRef(entity, state), `${state.host}.componentView;`]);
                attachEntities(entities, ctx, state, entity);

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

            // Attach created entities
            attachEntities(entities, ctx, state, entity);

            if (node.component) {
                // TODO Mount component
            }

            return entities;
        });
    }
} as AstVisitorMap;

function attachEntities(entities: Entity[], ctx: ElementContext, state: CompileState, entity: Entity) {
    entities.forEach(childEntity => {
        let insert: SourceNode;
        if (childEntity.type === 'element') {
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
        entity.fill.push(insert);
        // We’ve used injector for current element content: mount it
        if (ctx.usesInjector) {
            // TODO remove injector ref in unmount
            const injector = new Entity('block', ctx.injector);
            injector.mount = sn([
                createRef(ctx.injector, ctx.usage, state),
                `${state.runtime('createInjector')}(${entity.symbol});`
            ]);

            if (ctx.usage.update || ctx.usage.unmount) {
                injector.unmount = `${state.scope}.${ctx.injector} = null;`
            }

            entity.fill.push(injector);

        }
        entity.fill = entity.fill.concat(childEntity.fill);
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
