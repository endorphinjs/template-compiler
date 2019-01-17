import { SourceNode } from 'source-map';
import { Node } from '../ast/base';

export type Chunk = string | SourceNode;
export type ChunkList = Array<Chunk>;

/**
 * Returns quoted string
 */
export function qStr(text: string): string {
    return JSON.stringify(text);
}

/**
 * SourceNode factory which attaches location info to source map node from given
 * AST node
 */
export interface SourceNodeFactory {
    (node: Node, chunks?: Chunk | ChunkList, name?: string): SourceNode
}

/**
 * A factory for generating source map node from given AST node
 */
export const sn: SourceNodeFactory = (node, chunks, name) => {
    const output = new SourceNode();
    output.name = name;

    if (node.loc) {
        const pos = node.loc.start;
        output.line = pos.line;
        output.column = pos.column;
        output.source = node.loc.source;
    }

    if (Array.isArray(chunks)) {
        chunks = chunks.filter(Boolean);
        if (chunks.length) {
            output.add(chunks);
        }
    } else if (chunks) {
        output.add(chunks);
    }

    return output;
}
