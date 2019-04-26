import { ENDForEachStatement, Node } from "@endorphinjs/template-parser";
import Entity from "./Entity";
import CompileState from "./CompileState";
import { sn } from "../utils";
import { fn } from "../expression";
import { AstContinue } from "../template-visitors";

export default class IteratorEntity extends Entity {
    constructor(readonly node: ENDForEachStatement, readonly state: CompileState) {
        super('for', state);
    }

    setContent(statements: Node[], next: AstContinue): this {
        const { state, node, rawName } = this;
        this.setMount(() => {
            const select = fn(`${rawName}Select`, state, node.select);
            const key: string = node.key ? fn(`${rawName}Key`, state, node.key) : null;
            const content = state.runChildBlock(`${rawName}Content`, (ctx, element) =>
                element.setContent(statements, next));

            const args = sn([state.host, state.injector, select, key, content]);

            return sn([`${state.runtime(key ? 'mountKeyIterator' : 'mountIterator')}(`, args.join(', '), `)`]);
        });
        this.setUpdate(() => sn([`${state.runtime(node.key ? 'updateKeyIterator' : 'updateIterator')}(`, this.getSymbol(), `)`]))
        this.setUnmount(() => sn([`${state.runtime(node.key ? 'unmountKeyIterator' : 'unmountIterator')}(`, this.getSymbol(), `)`]));

        return this;
    }
}

