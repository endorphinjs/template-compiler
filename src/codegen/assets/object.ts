import { SourceNode } from "source-map";
import CompileScope from "../scope";
import { propSetter, Chunk } from '../utils';
import { ENDAttribute } from "../../ast/template";
import { compileAttributeValue } from "./attribute";

/**
 * Generates object literal from given attributes
 */
export default function generateObject(params: ENDAttribute[], scope: CompileScope, level: number = 0): SourceNode {
    const map: Map<Chunk, Chunk> = new Map();
    params.forEach(param => {
        map.set(propSetter(param.name, scope), compileAttributeValue(param.value, scope, true));
    });

    return toObjectLiteral(map, scope, level);
}

export function toObjectLiteral(map: Map<Chunk, Chunk>, scope: CompileScope, level: number = 0): SourceNode {
    const indent = scope.indent.repeat(level);
    const innerIndent = scope.indent.repeat(level + 1);
    const result = new SourceNode();
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
