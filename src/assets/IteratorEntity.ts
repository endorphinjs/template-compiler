import { ENDForEachStatement, Node } from "@endorphinjs/template-parser";
import Entity from "./Entity";
import CompileState from "./CompileState";
import { runtime, unmount } from "../utils";
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

            return runtime(key ? 'mountKeyIterator' : 'mountIterator', [state.host, state.injector, select, key, content], state, node);
        });
        this.setUpdate(() => runtime(node.key ? 'updateKeyIterator' : 'updateIterator', [this.getSymbol()], state, node))
        this.setUnmount(() => unmount(node.key ? 'unmountKeyIterator' : 'unmountIterator', this.getSymbol(), state, node));

        return this;
    }
}

