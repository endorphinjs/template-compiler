import { Chunk, ChunkList, EntityType } from "./types";
import { usageStats } from "./utils";

export default class Entity {
    mount?: Chunk;
    update?: Chunk;
    unmount?: Chunk;
    fill: ChunkList = [];

    /** Entity usage stats in different contexts */
    readonly usage = usageStats();

    constructor(readonly type: EntityType, private symbolGetter: string | {(): string}) {}

    get symbol(): string {
        return typeof this.symbolGetter === 'string'
            ? this.symbolGetter
            : this.symbolGetter();
    }
}
