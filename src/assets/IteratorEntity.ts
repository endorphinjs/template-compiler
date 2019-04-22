import { ENDForEachStatement, Program, Node } from "@endorphinjs/template-parser";
import Entity from "./Entity";
import CompileState from "./CompileState";
import { sn } from "../utils";
import generateExpression from "../expression";
import { AstContinue } from "../template-visitors";

export default class IteratorEntity extends Entity {
    constructor(readonly node: ENDForEachStatement, readonly state: CompileState) {
        super('for', state);
    }

    setContent(statements: Node[], next: AstContinue): this {
        const { state, node } = this;
        this.setMount(() => {
            const select = expr(`${this.name}Select`, state, node.select);
            const key: string = node.key ? expr(`${this.name}Key`, state, node.key) : null;
            const content = state.runChildBlock(`${this.name}Content`, (ctx, element) =>
                element.setContent(statements, next));

            const args = sn([state.host, state.element.injector, select, key, content]);

            return sn([`${state.runtime(key ? 'mountKeyIterator' : 'mountIterator')}(`, args.join(', '), `)`]);
        });
        this.setUpdate(() => sn([`${state.runtime(node.key ? 'updateKeyIterator' : 'updateIterator')}(`, this.getSymbol(), `)`]))
        this.setUnmount(() => sn([`${state.runtime(node.key ? 'unmountKeyIterator' : 'unmountIterator')}(`, this.getSymbol(), `)`]));

        return this;
    }
}

function expr(prefix: string, state: CompileState, value: Program): string {
    return state.runBlock(prefix, () =>
        new Entity('block', state).setMount(() =>
            sn(['return ', generateExpression(value, state)])));
}
