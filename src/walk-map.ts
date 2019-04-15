import { AstVisitors, ENDIfStatement } from "@endorphinjs/template-parser";
import CompileState from "./compile-state";
import { conditionEntity } from "./assets/condition";

export default {
    ENDIfStatement(node: ENDIfStatement, state, next) {
        state.pushEntity(conditionEntity(node, next))
    }
} as AstVisitors<CompileState>;
