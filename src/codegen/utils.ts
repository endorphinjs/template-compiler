import { SourceNode } from 'source-map';
import { JSNode } from '../ast/expression';

export type Chunk = string | SourceNode;
export type ChunkList = Array<Chunk>;

/**
 * Generates comma-separated list of given chunks with optional `before` and `after`
 * wrapper code
 */
export function commaChunks<T extends JSNode>(items: T[], before: string, after: string, fn: (node: T, chunks: ChunkList) => void): ChunkList {
    const chunks: ChunkList = [];

    before && chunks.push(before);
    items.forEach((node, i) => {
        if (i !== 0) {
            chunks.push(', ');
        }
        fn(node, chunks);
    });
    after && chunks.push(after);

    return chunks;
}
