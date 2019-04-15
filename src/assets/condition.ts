import { ENDIfStatement, ENDChooseCase } from "@endorphinjs/template-parser";
import CompileState from "../compile-state";
import { SourceNode } from "source-map";

/**
 * @description
 * Functions for generating condition blocks: `<if>` and `<choose>`
 */

/**
 * Generates condition entry function: tests condition and returns another function
 * for rendering matched block
 * @param conditions
 * @param state
 */
function conditionEntry(conditions: Array<ENDIfStatement | ENDChooseCase>, state: CompileState): string {
    const fnName = state.globalSymbol('conditionEntry');
    const indent = state.indent;
    const innerIndent = indent.repeat(2);
    const body = new SourceNode();

    return fnName;
}
