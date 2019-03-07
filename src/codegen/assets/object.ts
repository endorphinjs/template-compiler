import { SourceNode } from "source-map";
import CompileScope from "../scope";
import { SourceNodeFactory, propSetter } from '../utils';
import { ENDAttribute } from "../../ast/template";
import { Literal, Program } from "../../ast/expression";
import compileExpression from "../expression";

/**
 * Generates object literal from given attributes
 */
export default function generateObject(params: ENDAttribute[], scope: CompileScope, sn: SourceNodeFactory, level: number = 0): SourceNode {
    const result = new SourceNode();
    result.add('{');
    const indent = scope.indent.repeat(level);
    const innerIndent = scope.indent.repeat(level + 1);
    params.forEach((param, i) => {
        if (i !== 0) {
            result.add(',');
        }

        result.add(['\n', innerIndent, propSetter(param.name, scope), ': ']);

        // Argument value
        if (param.value instanceof Literal) {
            result.add(sn(param.value, JSON.stringify(param.value.value)));
        } else if (param.value instanceof Program) {
            result.add(compileExpression(param.value, scope));
        } else if (param.value === null) {
            // Passing prop as boolean
            result.add('true');
        } else {
            result.add('null');
        }
    });
    if (params.length) {
        result.add(`\n${indent}`);
    }
    result.add(`}`);
    return result;
}
