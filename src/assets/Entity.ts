import { SourceNode } from "source-map";
import { Chunk, UsageContext } from "../types";
import { sn } from "../utils";
import CompileState from "../compile-state";
import UsageStats from "./UsageStats";

type RenderChunk = (entity: Entity) => Chunk;
type SymbolType = UsageContext | 'ref';

export default class Entity {
    children: Entity[] = [];

    /** Entity symbol name */
    name: string;
    readonly symbolUsage = new UsageStats();
    private symbols: { [K in SymbolType]?: SourceNode };
    code: { [K in UsageContext]?: Chunk };

    constructor(readonly rawName: string, readonly state: CompileState) {
        // NB `ref` is a variable declaration in mount scope
        this.name = state.scopeSymbol(rawName);
        this.code = {
            mount: null,
            update: null,
            unmount: null
        };
        this.symbols = {
            mount: null,
            update: null,
            unmount: null,
            ref: new SourceNode()
        };
    }

    /**
     * Symbol for referencing current entity in current render scope.
     * Note that node returned by current method is self-modified depending on entity usage
     */
    getSymbol(): SourceNode {
        const { renderContext } = this.state;
        const { symbols, symbolUsage, name } = this;

        symbolUsage.use(renderContext);

        if (renderContext === 'mount') {
            // In `mount` context, we should always refer entity by local variable
            if (symbolUsage.mount === 1) {
                symbols.ref.prepend(`const ${name} = `);
            }
            return symbols.mount || (symbols.mount = sn(name));
        }

        if (symbolUsage.update + symbolUsage.unmount === 1) {
            // First time use of entity in update of unmount scope:
            // create reference in component scope
            this.state.mount(() => symbols.ref.add(`${this.state.scope}.${name} = `));
        }

        const ctx: UsageContext = renderContext === 'shared' ? 'update' : renderContext;

        if (symbolUsage[ctx] === 1) {
            // First time access to non-mount context: use symbol from component scope
            symbols[ctx] = sn(`${this.state.scope}.${name}`);
        } else if (symbolUsage[ctx] === 2) {
            // If we use symbol more than once in non-mount context, it’s more
            // optimal to use local variable.
            // NB: local variable should be created by block generator
            symbols[ctx].children.length = 0;
            symbols[ctx].add(`${name}`);
        }

        return symbols[ctx];
    }

    /**
     * Returns mount code for current entity
     */
    getMount(): SourceNode {
        if (this.code.mount) {
            return sn([this.symbols.ref, this.code.mount])
        }
    }

    /**
     * Set mount code for given entity
     */
    setMount(fn: RenderChunk): this {
        this.code.mount = this.state.mount(() => fn(this));
        return this;
    }

    /**
     * Returns entity update code
     */
    getUpdate(): Chunk {
        return this.code.update;
    }

    /**
     * Set update code for given entity
     */
    setUpdate(fn: RenderChunk): this {
        this.code.update = this.state.update(() => fn(this));
        return this;
    }

    /**
     * Returns entity update code
     */
    getUnmount(): Chunk {
        return this.code.unmount;
    }

    /**
     * Set unmount code for given entity
     */
    setUnmount(fn: RenderChunk): this {
        this.code.unmount = this.state.unmount(() => fn(this));
        return this;
    }

    /**
     * Set shared (mount and update) code for given entity
     */
    setShared(fn: RenderChunk): this {
        this.code.mount = this.code.update = this.state.shared(() => fn(this));
        return this;
    }

    /**
     * Adds given entity as a child of current one
     */
    add(entity: Entity) {
        this.children.push(entity);
    }
}
