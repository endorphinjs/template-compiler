import { ENDAttribute } from "@endorphinjs/template-parser";
import { SourceNode } from "source-map";
import CompileState from "./CompileState";
import { propSetter, sn, } from '../utils';
import { compileAttributeValue } from "./AttributeEntity";
import { Chunk } from "../types";

/**
 * Generates object literal from given attributes
 */
export default function generateObject(params: ENDAttribute[], scope: CompileState, level: number = 0): SourceNode {
    const map: Map<Chunk, Chunk> = new Map();
    params.forEach(param => {
        map.set(propSetter(param.name, scope), compileAttributeValue(param.value, scope, true));
    });

    return toObjectLiteral(map, scope, level);
}

export function toObjectLiteral(map: Map<Chunk, Chunk>, state: CompileState, level: number = 0): SourceNode {
    const indent = state.indent.repeat(level);
    const innerIndent = state.indent.repeat(level + 1);
    const result = sn();
    let i = 0;

    result.add('{');
    map.forEach((value, key) => {
        if (i++ !== 0) {
            result.add(',');
        }

        result.add(['\n', innerIndent, key, ': ', value]);
    });

    if (map.size) {
        result.add(`\n${indent}`);
    }

    result.add(`}`);
    return result;
}
