import { Program, MemberExpression, CallExpression } from "@endorphinjs/template-parser";
import { SourceNode } from "source-map";
import CompileState from "../assets/CompileState";
import { WalkVisitorMap, walk } from "./utils";
import baseVisitors from "./baseVisitors";
import { createGetter, createCaller } from "./getter";

const expressionVisitors: WalkVisitorMap = {
    ...baseVisitors,
    MemberExpression(node: MemberExpression, state, next) {
        const getter = createGetter(node);
        if (getter.type === 'ENDGetter') {
            return next(getter);
        }

        return baseVisitors.MemberExpression(getter, state, next);
    },
    CallExpression(node: CallExpression, state, next) {
        const caller = createCaller(node);
        if (caller.type === 'ENDCaller') {
            return next(caller);
        }

        return baseVisitors.CallExpression(caller, state, next);
    }
}

export default function generateExpression(expr: Program, state: CompileState, visitors: WalkVisitorMap = {}): SourceNode {
    return walk(expr, state, { ...expressionVisitors, ...visitors });
}
