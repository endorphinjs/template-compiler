import Entity from "./Entity";
import { ENDInnerHTML } from "@endorphinjs/template-parser";
import CompileState from "./CompileState";
import { sn } from "../utils";
import { fn } from "../expression";

export default class InnerHTMLEntity extends Entity {
    constructor(readonly node: ENDInnerHTML, readonly state: CompileState) {
        super('html', state);

        this.setMount(() => {
            const args = sn([state.host, state.injector, fn('html', state, node.value)]);
            return sn([`${state.runtime('mountInnerHTML')}(`, args.join(', '), ')'], node);
        });

        this.setUpdate(() => sn([`${state.runtime('updateInnerHTML')}(`, this.getSymbol(), `)`]));
        this.setUnmount(() => sn([`${state.runtime('unmountInnerHTML')}(`, this.getSymbol(), `)`]));
    }
}
