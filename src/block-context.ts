import ElementContext from "./element-context";
import { usageStats, markUsed, sn, format } from "./utils";
import CompileState from "./compile-state";
import { ChunkList, Chunk } from "./types";
import Entity from "./entity";

const injectorArg = 'injector';

export default class BlockContext {
    element?: ElementContext;
    scopeUsage = usageStats();

    usesInjector?: boolean;

    /**
     * @param name Name of the block, will be used as suffix in generated function
     * so it must be unique in its scope
     */
    constructor(readonly name: string, readonly state: CompileState) {}

    /**
     * Variable reference to component scope
     */
    get scope(): string {
        markUsed(this.scopeUsage, this.state.renderContext);
        return this.rawScope;
    }

    /**
     * Variable reference to component scope without marking usage
     */
    get rawScope(): string {
        return this.state.options.scope;
    }

    get injector(): string {
        if (this.element) {
            return this.element.injector;
        }

        // Assume that block should receive injector as argument
        this.usesInjector = true;
        return injectorArg;
    }

    /**
     * Generates mount, update and unmount functions from given entities
     */
    generate(entities: Entity[]): ChunkList {
        const { state, name, scopeUsage, rawScope: scope } = this;
        const scopeArg = (count: number, first?: boolean): string => count ? `${first ? '' : ', '}${scope}` : '';

        let mountChunks: ChunkList = [];
        const updateChunks: ChunkList = [];
        const unmountChunks: ChunkList = [];
        const updateRefs: string[] = [];

        // List of entities that must be explicitly nulled because of absent unmount code
        const toNull: Entity[] = [];

        entities.forEach(entity => {
            if (entity.mountCode) {
                mountChunks.push(entity.mountCode);
            }

            mountChunks = mountChunks.concat(entity.content);

            if (entity.updateCode) {
                updateChunks.push(entity.updateCode);
            }

            if (entity.unmountCode) {
                unmountChunks.push(entity.unmountCode);
            } else if (entity.usage.update) {
                // Entity was used in update code, which means it’s in component scope.
                // We have to reset it
                toNull.push(entity);
            }

            if (entity.usage.update) {
                updateRefs.push(entity.symbol);
            }
        });

        if (toNull.length) {
            markUsed(scopeUsage, 'unmount');
            unmountChunks.push(toNull.map(entity => `${scope}.${entity.symbol} = `).join('') + 'null;');
        }

        if (updateRefs.length) {
            markUsed(scopeUsage, 'update');
            updateChunks.unshift(`const { ${updateRefs.join(', ')} } = ${scope};`);
        }

        if (unmountChunks.length) {
            mountChunks.push(`${state.runtime('addDisposeCallback')}(${state.host}, ${name}Unmount);`);
        }

        if (updateChunks.length) {
            mountChunks.push(`return ${name}Update;`);
        }

        const { indent } = state;
        return [
            createFunction(name, `${state.host}${this.usesInjector ? ', ' + injectorArg : ''}${scopeArg(scopeUsage.mount)}`, mountChunks, indent),
            createFunction(`${name}Update`, `${state.host}${scopeArg(scopeUsage.update)}`, updateChunks, indent),
            createFunction(`${name}Unmount`, scopeArg(scopeUsage.unmount, true), unmountChunks, indent)
        ];
    }
}

/**
 * Generates function from given fragments
 */
function createFunction(name: string, args: string, chunks: ChunkList, indent: string = '\t'): Chunk {
    if(chunks && chunks.length) {
        return sn([
            `\nfunction ${name}(${args}) {\n${indent}`,
            ...format(chunks, indent),
            '\n}'
        ]);
    }
}
