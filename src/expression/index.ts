import { Program, JSNode } from "@endorphinjs/template-parser";
import { SourceNode } from "source-map";
import CompileState from "../assets/CompileState";
import { WalkVisitorMap, walk } from "./utils";
import baseVisitors from "./baseVisitors";
import { entity } from "../assets/Entity";
import { sn } from "../utils";

export default function generateExpression(expr: JSNode, state: CompileState, visitors: WalkVisitorMap = {}): SourceNode {
    return walk(expr, state, { ...baseVisitors, ...visitors });
}

/**
 * Generates function from given JS code in compile state
 * @param prefix
 * @param state
 * @param value
 */
export function fn(prefix: string, state: CompileState, value: Program): string {
    return state.runBlock(prefix, () =>
        entity('block', state, {
            mount: () => sn(['return ', generateExpression(value, state)])
        }));
}
