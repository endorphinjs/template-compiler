import { SourceNode } from 'source-map';
import { AstWalkerContinuation, Node, Identifier, Program } from '@endorphinjs/template-parser';
import { BuilderContext } from "./builder";
import generateExpression from './expression';

export type Chunk = string | SourceNode;
export type ChunkList = Chunk[];
export type AstContinue = AstWalkerContinuation<BuilderContext>

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

/**
 * Factory function for creating source node with given chunks and location of
 * given node
 */
export function sn(chunks: Chunk | ChunkList, node?: Node, name?: string): SourceNode {
    const result = new SourceNode();
    if (name) {
        result.name = name;
    }

    if (Array.isArray(chunks)) {
        chunks = chunks.filter(Boolean);
        if (chunks.length) {
            result.add(chunks);
        }
    } else if (chunks) {
        result.add(chunks);
    }

    if (node && node.loc) {
        const pos = node.loc.start;
        result.line = pos.line;
        result.column = pos.column;
        result.source = node.loc.source;
    }

    return result;
}

/**
 * Check if given name can be used as property identifier
 */
export function isIdentifier(name: string): boolean {
    return /^[a-zA-Z_$][\w_$]*$/.test(name);
}

/**
 * Returns quoted string
 */
export function qStr(text: string): string {
    return JSON.stringify(text);
}

/**
 * Generates property getter code
 */
export function propGetter(name: string): string {
    return isIdentifier(name) ? `.${name}` : `[${qStr(name)}]`;
}

/**
 * Generates property setter code
 */
export function propSetter(node: Identifier | Program, ctx: BuilderContext): Chunk {
    if (node.type === 'Program') {
        const result = new SourceNode();
        result.add(['[', generateExpression(node, ctx), ']']);
        return result;
    }

    return isIdentifier(node.name) ? node.name : qStr(node.name)
}
