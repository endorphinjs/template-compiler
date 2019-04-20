import * as Ast from '@endorphinjs/template-parser';
import { SourceNode } from 'source-map';
import CompileState from "./compile-state";
import { createElement } from './assets/element';
import Entity from './entity';
import { sn, flatten, qStr, format, isLiteral } from './utils';
import { UsageStats, Chunk, CompileStateOptions, ChunkList } from './types';
import ElementContext from './element-context';
import { attributeEntity } from './assets/attribute';
import { ENDCompileError } from './error';
import generateExpression from './expression';

type AstContinue = (node: Ast.Node) => Entity | Entity[] | void;
type AstVisitor = (node: Ast.Node, state: CompileState, next: AstContinue) => Entity | Entity[] | void;
type AstVisitorMap = { [name: string]: AstVisitor };

export default function generateTemplate(ast: Ast.ENDProgram, options?: CompileStateOptions): SourceNode {
    const state = new CompileState(options);
    const body: ChunkList = [];

    // Collect child components. We should do it in separate pass to hoist component
    // definitions before templates are rendered
    registerComponents(ast, state);

    // Compile template to collect usage stats as well
    const template = compileTemplate(ast, state);

    // Import runtime symbols, used by template
    if (state.usedRuntime.size) {
        body.push(`import { ${Array.from(state.usedRuntime).join(', ')} } from "${state.options.module}";`);
    }

    // Import helpers
    state.getUsedHelpers().forEach((helpers, url) => {
        body.push(`import { ${helpers.join(', ')} } from ${qStr(url)};`);
    });

    // Import child components
    state.componentsMap.forEach((item, name) => {
        if (item.used) {
            body.push(`import * as ${item.symbol} from ${qStr(item.href)};`);
        } else {
            state.warn(`Unused import "${name}", skipping`, item.node.loc.start.offset);
        }
    });

    // CSS scoping
    if (state.options.cssScope) {
        body.push(`export const cssScope = ${qStr(state.options.cssScope)};`);
    }

    // Used namespaces
    state.namespaceSymbols.forEach((symbol, uri) => {
        body.push(`const ${symbol} = ${qStr(uri)};`);
    });

    // Output scripts
    ast.scripts.forEach(script => {
        if (script.url) {
            body.push(sn(`export * from ${qStr(script.url)};`));
        } else if (script.transformed || script.content) {
            body.push(sn(script.transformed || script.content));
        }
    });

    body.push('', template);

    return sn(format(body));
}

const baseVisitors = {
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
        state.pushOutput(`export default ${name};`);
    },

    ENDElement(node: Ast.ENDElement, state, next) {
        return state.runElement(node, (ctx, entity) => {
            // Edge case: element with single text child
            const firstChild = node.body[0];
            if (!state.isComponent(node) && node.body.length === 1 && isLiteral(firstChild)) {
                entity.mount(() => createElement(node, state, firstChild));
            } else {
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

function compileTemplate(ast: Ast.ENDProgram, state: CompileState) {
    const next: AstContinue = node => {
        if (node.type in baseVisitors) {
            return baseVisitors[node.type](node, state, next);
        }
        throw new ENDCompileError(`${node.type} is not supported in templates`, node);
    };

    ast.body.forEach(node => {
        if (node.type === 'ENDTemplate' || node.type === 'ENDPartial') {
            next(node);
        }
    });

    return state.output;
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
        }

        entity.push(childEntity.content);
        childEntity.mountCode = null;
        childEntity.content.length = 0;
    });
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

function registerComponents(ast: Ast.ENDProgram, state: CompileState) {
    ast.body.forEach(node => {
        if (node.type === 'ENDImport') {
            state.registerComponent(node);
        }
    });
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
