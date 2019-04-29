import { ENDIfStatement, ENDChooseStatement, ENDChooseCase, ENDStatement, Program } from "@endorphinjs/template-parser";
import Entity from "./entity";
import CompileState from "./CompileState";
import { AstContinue } from "../template-visitors";
import { sn, runtime } from "../utils";
import generateExpression from "../expression";

export default class ConditionEntity extends Entity {
    constructor(readonly node: ENDIfStatement | ENDChooseStatement, state: CompileState) {
        super(node.type === 'ENDIfStatement' ? 'if' : 'choose', state);
    }

    setContent(statements: Array<ENDIfStatement | ENDChooseCase>, next: AstContinue): this {
        const { state } = this;
        this.setMount(() => runtime('mountBlock', [state.host, state.injector, conditionEntry(this.rawName, statements, state, next)], state))
            .setUpdate(() => runtime('updateBlock', [this.getSymbol()], state))
            .setUnmount(() => runtime('unmountBlock', [this.getSymbol()], state));

        return this;
    }

    setSimple(test: Program, statements: ENDStatement[], next: AstContinue) {
        this.setMount(() => {
            const fn = ifAttr(test, statements, this.state, next);
            return sn([`${fn}(${this.state.host}, `, this.state.injector, ')']);
        });
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

function ifAttr(test: Program, statements: ENDStatement[], state: CompileState, next: AstContinue): string {
    return state.runChildBlock('ifAttr', () => {
        return new Entity('block', state).setMount(() => {
            const body = sn();
            const indent = state.indent.repeat(2);

            body.add([`if (`, generateExpression(test, state), ') {']);
            statements.forEach(child => {
                const childEntity = next(child);
                if (childEntity) {
                    body.add(['\n', indent, childEntity.getMount()]);
                }
            });
            body.add(`\n${state.indent}}`);
            body.add(`\n${state.indent}return 0;`)

            return body;
        });
    });
}
