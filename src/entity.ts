import { Chunk, ChunkList, EntityType } from "./types";
import { usageStats, markUsed, createVar } from "./utils";
import CompileState from "./compile-state";

type RenderChunk = (entity: Entity) => Chunk;

export default class Entity {
    mountCode?: Chunk;
    updateCode?: Chunk;
    unmountCode?: Chunk;
    content: ChunkList = [];

    /** Entity usage stats in different contexts */
    readonly usage = usageStats();

    private _symbol: string;

    constructor(readonly type: EntityType, symbol: string, readonly state?: CompileState) {
        this._symbol = symbol;
    }

    get symbol(): string {
        if (this.state) {
            markUsed(this.usage, this.state.renderContext);
            if (this.state.renderContext === 'unmount') {
                return `${this.state.scope}.${this._symbol}`;
            }
        }
        return this._symbol;
    }

    /**
     * Set mount code for given entity
     */
    mount(fn: RenderChunk): this {
        this.mountCode = this.state
            ? this.state.mount(() => fn(this))
            : fn(this);
        return this;
    }

    /**
     * Set update code for given entity
     */
    update(fn: RenderChunk): this {
        this.updateCode = this.state
            ? this.state.update(() => fn(this))
            : fn(this);
        return this;
    }

    /**
     * Set unmount code for given entity
     */
    unmount(fn: RenderChunk): this {
        this.unmountCode = this.state
            ? this.state.unmount(() => fn(this))
            : fn(this);
        return this;
    }

    /**
     * Set shared (mount and update) code for given entity
     */
    shared(fn: RenderChunk): this {
        this.mountCode = this.updateCode = this.state
            ? this.state.shared(() => fn(this))
            : fn(this);
        return this;
    }

    /**
     * Adds given chunks to entity content fill section
     */
    push(...items: Array<Chunk | ChunkList>): ChunkList {
        return this.content = this.content.concat(...items);
    }

    prepend(chunk: Chunk) {
        this.content.unshift(chunk);
    }

    /**
     * Creates variable references for current entity based on its usage stats
     */
    createVar(): string {
        return createVar(this, this.usage, this.state);
    }

    toString(): string {
        return this.symbol;
    }
}
