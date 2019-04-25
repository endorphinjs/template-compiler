import { Program } from "@endorphinjs/template-parser";
import { SourceNode } from "source-map";
import CompileState from "../assets/CompileState";
import { WalkVisitorMap, walk } from "./utils";
import baseVisitors from "./baseVisitors";

export default function generateExpression(expr: Program, state: CompileState, visitors: WalkVisitorMap = {}): SourceNode {
    return walk(expr, state, { ...baseVisitors, ...visitors });
}
