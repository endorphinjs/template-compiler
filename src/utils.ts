import { SourceNode } from 'source-map';
import { Node, Identifier, Program, ENDElement, ENDAttributeStatement, LiteralValue, ENDAttribute } from '@endorphinjs/template-parser';
import generateExpression from './expression';
import CompileState from './compile-state';
import { Chunk, ChunkList, UsageStats, RenderContext } from './types';

/**
 * A prefix for Endorphin element and attribute names
 */
export const prefix = 'e';
const nsPrefix = prefix + ':';

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
 * Creates usage stats object
 */
export function usageStats(): UsageStats {
    return {
        mount: 0,
        update: 0,
        unmount: 0
    };
}

/**
 * Marks given context in usage stats as used
 */
export function markUsed(stats: UsageStats, ctx: RenderContext): void {
    if (ctx) {
        stats[ctx]++;
    }
}

/**
 * Returns attribute with given name from tag name definition, if any
 */
export function getAttr(elem: ENDElement | ENDAttributeStatement, name: string): ENDAttribute {
    return elem.attributes.find(attr => attr.name.type === 'Identifier' && attr.name.name === name);
}

/**
 * Returns value of attribute with given name from tag name definition, if any
 */
export function getAttrValue(openTag: ENDElement | ENDAttributeStatement, name: string): LiteralValue {
    const attr = getAttr(openTag, name);
    if (attr && attr.value.type === 'Literal') {
        return attr.value.value;
    }
}

/**
 * Returns control statement name from given tag name if possible
 * @param name Tag name
 */
export function getControlName(name: string): string {
    if (name.startsWith(nsPrefix)) {
        return name.slice(nsPrefix.length);
    }

    if (name.startsWith('partial:')) {
        return 'partial';
    }

    return null;
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
export function propSetter(node: Identifier | Program, state: CompileState): Chunk {
    if (node.type === 'Program') {
        const result = new SourceNode();
        result.add(['[', generateExpression(node, state), ']']);
        return result;
    }

    return isIdentifier(node.name) ? node.name : qStr(node.name)
}

export function flatten<T>(arr: Array<T | T[]>): T[] {
    let result: T[];
    arr.forEach(arg => {
        if (Array.isArray(arg)) {
            result = result.concat(flatten(arg));
        } else {
            result.push(arg);
        }
    });

    return result;
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
        : chunk && chunk.length !== 0;
}
