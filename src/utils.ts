import { SourceNode } from 'source-map';
import { AstWalkerContinuation } from '@endorphinjs/template-parser';
import CompileState from './compile-state';

export type Chunk = string | SourceNode;
export type ChunkList = Chunk[];
export type AstContinue = AstWalkerContinuation<CompileState>

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
