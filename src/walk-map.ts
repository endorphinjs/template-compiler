import { AstVisitors, ENDIfStatement, ENDChooseCase, ENDStatement, AstWalkerContinuation } from "@endorphinjs/template-parser";
import CompileState from "./compile-state";
import { SourceNode } from "source-map";
import { AstContinue } from "./utils";

export default {
    ENDIfStatement(node: ENDIfStatement, state, next) {

    }
} as AstVisitors<CompileState>;

function conditionEntry(conditions: Array<ENDIfStatement | ENDChooseCase>, state: CompileState, next: AstContinue): string {
    const fnName = state.globalSymbol('conditionEntry');
    const indent = state.indent;
    const innerIndent = indent.repeat(2);
    const body = new SourceNode();

    conditions.forEach((block, i) => {
        if (i === 0) {
            body.add([`if (`, compileExpression(block.test, state), ') ']);
        } else if (block.test) {
            body.add([` else if (`, compileExpression(block.test, state), ') ']);
        } else {
            body.add(' else ');
        }

        const blockContent = conditionContent('conditionBody', state, block.consequent, next);
        body.add(`{\n${innerIndent}return ${blockContent};\n${indent}}`);
    });

    state.pushOutput(body);

    return fnName;
}

/**
 * Generates contents of condition function and returns name of this function
 */
function conditionContent(prefix: string, state: CompileState, statements: ENDStatement[], next: AstContinue): string {
    return state.block(prefix, block => {
        statements.forEach(node => next(node, state));
        return block.generate();
    });
}
