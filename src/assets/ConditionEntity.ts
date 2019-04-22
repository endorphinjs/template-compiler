import { ENDIfStatement, ENDChooseStatement, ENDChooseCase } from "@endorphinjs/template-parser";
import Entity from "./entity";
import CompileState from "./CompileState";
import { AstContinue } from "../template-visitors";
import { sn } from "../utils";
import generateExpression from "../expression";

export default class ConditionEntity extends Entity {
    constructor(readonly node: ENDIfStatement | ENDChooseStatement, state: CompileState) {
        super(node.type === 'ENDIfStatement' ? 'if' : 'choose', state);
    }

    setContent(statements: Array<ENDIfStatement | ENDChooseCase>, next: AstContinue): this {
        const { state } = this;
        this.setMount(() => sn([`${state.runtime('mountBlock')}(${state.host}, `, state.injector, `, ${conditionEntry(this.name, statements, state, next)})`]))
            .setUpdate(() => sn([`${state.runtime('updateBlock')}(`, this.getSymbol(), `)`]))
            .setUnmount(() => sn([`${state.runtime('unmountBlock')}(`, this.getSymbol(), `)`]));

        return this;
    }
}

/**
 * Generates condition entry function: tests condition and returns another function
 * for rendering matched block
 */
function conditionEntry(name: string, conditions: Array<ENDIfStatement | ENDChooseCase>, state: CompileState, next: AstContinue): string {
    const indent = state.indent;
    const innerIndent = indent.repeat(2);

    return state.runBlock(`${name}Entry`, () => {
        return new Entity('block', state).setMount(() => {
            const body = sn();

            conditions.forEach((block, i) => {
                if (i === 0) {
                    body.add([`if (`, generateExpression(block.test, state), ') ']);
                } else if (block.test) {
                    body.add([` else if (`, generateExpression(block.test, state), ') ']);
                } else {
                    body.add(' else ');
                }

                const blockContent = state.runChildBlock(`${name}Body`, (ctx, element) =>
                    element.setContent(block.consequent, next));

                // const blockContent = conditionContent(`${name}Body`, state, block.consequent, next);
                body.add(`{\n${innerIndent}return ${blockContent};\n${indent}}`);
            });

            return body;
        });
    });
}
