import { Node } from "@endorphinjs/template-parser";
import CompileState from "../assets/CompileState";
import { Chunk, ChunkList } from "../types";
import { SourceNode } from "source-map";
import { ENDCompileError } from "../error";

export type WalkContinue = (node: Node) => SourceNode;
export type WalkVisitor = (node: Node, state: CompileState, next: WalkContinue) => SourceNode;
export type WalkVisitorMap = { [name: string]: WalkVisitor };

export function walk(node: Node, state: CompileState, visitors: WalkVisitorMap): SourceNode {
    const next: WalkContinue = node => {
        if (node.type in visitors) {
            return visitors[node.type](node, state, next);
        }

        throw new ENDCompileError(`${node.type} is not supported in getter expressions`, node);
    }

    return next(node);
}

/**
 * Returns accessor prefix from host component for given token
 */
export function getPrefix(context: string, state: CompileState): string {
    if (context === 'property') {
        return `${state.host}.props`;
    }

    if (context === 'state') {
        return `${state.host}.state`;
    }

    if (context === 'variable') {
        return state.scope;
    }

    if (context === 'store') {
        return `${state.host}.store.data`;
    }

    return '';
}

/**
 * Generates comma-separated list of given chunks with optional `before` and `after`
 * wrapper code
 */
export function commaChunks(items: Chunk[], before?: string, after?: string): ChunkList {
    const chunks: ChunkList = [];

    before != null && chunks.push(before);
    items.forEach((node, i) => {
        if (i !== 0) {
            chunks.push(', ');
        }
        chunks.push(node);
    });
    after != null && chunks.push(after);

    return chunks;
}
