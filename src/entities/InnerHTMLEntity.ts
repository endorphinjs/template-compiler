import { ENDInnerHTML } from "@endorphinjs/template-parser";
import Entity from "./Entity";
import { fn } from "../expression";
import CompileState from "../lib/CompileState";
import { runtime, unmount } from "../lib/utils";

export default class InnerHTMLEntity extends Entity {
    constructor(readonly node: ENDInnerHTML, readonly state: CompileState) {
        super('html', state);
        this.setMount(() => runtime('mountInnerHTML', [state.host, state.injector, fn('html', state, node.value)], state, node));
        this.setUpdate(() => runtime('updateInnerHTML', [this.getSymbol()], state, node));
        this.setUnmount(() => unmount('unmountInnerHTML', this.getSymbol(), state, node));
    }
}
