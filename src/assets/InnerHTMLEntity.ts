import { ENDInnerHTML } from "@endorphinjs/template-parser";
import Entity from "./Entity";
import CompileState from "./CompileState";
import { fn } from "../expression";
import { runtime } from "../utils";

export default class InnerHTMLEntity extends Entity {
    constructor(readonly node: ENDInnerHTML, readonly state: CompileState) {
        super('html', state);
        this.setMount(() => runtime('mountInnerHTML', [state.host, state.injector, fn('html', state, node.value)], state, node));
        this.setUpdate(() => runtime('updateInnerHTML', [this.getSymbol()], state, node));
        this.setUnmount(() => runtime('unmountInnerHTML', [this.getSymbol()], state, node));
    }
}
