import { Literal, Program } from "@endorphinjs/template-parser";
import Entity from "./entity";
import CompileState from "../compile-state";
import generateExpression from "../expression";
import { isExpression, sn, qStr } from "../utils";

export default class TextEntity extends Entity {
    constructor(readonly node: Literal | Program, readonly state: CompileState) {
        super('text', state);
        if (isExpression(node)) {
            const expr = state.shared(() => generateExpression(node, state));
            this.setMount(() => sn([`${state.runtime('text')}(`, expr, ')'], node));
            this.setUpdate(() => sn([`${state.runtime('updateText')}(`, this.getSymbol(), `, `, expr, ')'], node));
        } else {
            this.setMount(() => sn(`${state.runtime('text')}(${qStr(node.value as string)})`, node));
        }
    }
}
