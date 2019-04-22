import CompileState from "./CompileState";
import { ChunkList, Chunk } from "../types";
import Entity from "./Entity";
import ElementEntity from "./ElementEntity";
import UsageStats from "./UsageStats";
import { sn, format } from "../utils";

const injectorArg = 'injector';

export default class BlockContext {
    element?: ElementEntity;
    scopeUsage = new UsageStats();

    /** Should block use injector as argument */
    useInjector?: boolean;

    /**
     * @param name Name of the block, will be used as suffix in generated function
     * so it must be unique in its scope
     */
    constructor(readonly name: string, readonly state: CompileState) {}

    /**
     * Variable reference to component scope
     */
    get scope(): string {
        this.scopeUsage.use(this.state.renderContext);
        return this.rawScope;
    }

    /**
     * Variable reference to component scope without marking usage
     */
    get rawScope(): string {
        return this.state.options.scope;
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
        let mount: Chunk | void;
        let update: Chunk | void;
        let unmount: Chunk | void;

        const output = (entities: Entity[]) => {
            entities.forEach(entity => {
                if (mount = entity.getMount()) {
                    mountChunks.push(mount);
                }

                output(entity.children);

                if (update = entity.getUpdate()) {
                    updateChunks.push(update);
                }

                if (unmount = entity.getUnmount()) {
                    unmountChunks.push(unmount);
                } else if (entity.symbolUsage.update) {
                    // Entity was used in update code, which means it’s in component scope.
                    // We have to reset it
                    toNull.push(entity);
                }

                // Destructure element refs for smaller code
                if (entity.symbolUsage.update > 1) {
                    updateRefs.push(entity.name);
                }
            });
        };

        output(entities);

        if (toNull.length) {
            scopeUsage.use('unmount');
            unmountChunks.push(toNull.map(entity => `${scope}.${entity.name} = `).join('') + 'null');
        }

        if (updateRefs.length) {
            scopeUsage.use('update');
            updateChunks.unshift(`const { ${updateRefs.join(', ')} } = ${scope}`);
        }

        if (unmountChunks.length) {
            mountChunks.push(`${state.runtime('addDisposeCallback')}(${state.host}, ${name}Unmount)`);
        }

        if (updateChunks.length) {
            mountChunks.push(`return ${name}Update`);
        }

        const { indent } = state;
        return [
            createFunction(name, `${state.host}${this.useInjector ? ', ' + injectorArg : ''}${scopeArg(scopeUsage.mount)}`, mountChunks, indent),
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
