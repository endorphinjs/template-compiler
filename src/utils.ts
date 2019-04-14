import { SourceNode } from 'source-map';

export type Chunk = string | SourceNode;
export type ChunkList = Chunk[];

/**
 * Converts given HTML tag name to JS variable name
 */
export function tagToJS(name: string, capitalize: boolean = false): string {
    name = name
        .replace(/-(\w)/g, (str: string, p1: string) => p1.toUpperCase())
        .replace(/\W/g, '_');
    if (capitalize && name) {
        name = name[0].toUpperCase() + name.slice(1);
    }

    return name;
}
