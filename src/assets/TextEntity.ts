import { Literal, Program } from "@endorphinjs/template-parser";
import Entity from "./entity";
import CompileState from "./CompileState";
import generateExpression from "../expression";
import { isExpression, qStr, runtime } from "../utils";

export default class TextEntity extends Entity {
    constructor(readonly node: Literal | Program, readonly state: CompileState) {
        super('text', state);
        if (isExpression(node)) {
            const expr = state.shared(() => generateExpression(node, state));
            this.setMount(() => runtime('text', [expr], state, node));
            this.setUpdate(() => runtime('updateText', [this.getSymbol(), expr], state, node));
        } else {
            this.setMount(() => runtime('text', [qStr(node.value as string)], state, node));
        }
    }
}
