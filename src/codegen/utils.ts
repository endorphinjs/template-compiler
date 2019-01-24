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

/**
 * Converts given HTML tag name to JS variable name
 */
export function tagToJS(name: string, capitalize: boolean): string {
    name = name.replace(/-(\w)/g, (str: string, p1: string) => p1.toUpperCase());
    if (capitalize && name) {
        name = name[0].toUpperCase() + name.slice(1);
    }

    return name;

}

export function format(chunks: ChunkList, prefix: string = '', suffix: string = '\n'): ChunkList {
    const result: ChunkList = [];

    chunks.filter(isValidChunk).forEach((chunk, i, arr) => {
        if (i !== 0) {
            result.push(prefix);
        }

        result.push(chunk);

        if (i !== arr.length - 1) {
            result.push(suffix);
        }
    });
    return result;
}

function isValidChunk(chunk: Chunk): boolean {
    return chunk instanceof SourceNode
        ? chunk.children.length !== 0
        : chunk.length !== 0;
}

/**
 * Check if given name can be used as property identifier
 */
export function isIdentifier(name: string): boolean {
    return /^[a-zA-Z_$][\w_$]*$/.test(name);
}

/**
 * Generates property accessor code
 */
export function propAccessor(name: string): string {
    return isIdentifier(name) ? `.${name}` : `[${qStr(name)}]`;
}
