import { ENDIfStatement, ENDChooseCase, ENDStatement, ENDChooseStatement } from "@endorphinjs/template-parser";
import { SourceNode } from "source-map";
import generateExpression from "../expression";
import { flatten, sn } from "../utils";
import CompileState from "../compile-state";
import { AstContinue } from "../template-visitors";
import Entity from "../entity";

/**
 * @description
 * Functions for generating condition blocks: `<if>` and `<choose>`
 */

export function conditionEntity(node: ENDIfStatement | ENDChooseStatement, state: CompileState, next: AstContinue) {
    const body = node.type === 'ENDIfStatement' ? [node] : node.cases;
    const name = node.type === 'ENDIfStatement' ? 'if' : 'choose';

    return state.entity('block', name)
        .mount(() => `${state.runtime('mountBlock')}(${state.host}, ${state.injector}, ${conditionEntry(name, body, state, next)});`)
        .update(entity => `${state.runtime('updateBlock')}(${entity});`)
        .unmount(entity => `${entity} = ${state.runtime('unmountBlock')}(${entity});`);
}

/**
 * Generates condition entry function: tests condition and returns another function
 * for rendering matched block
 */
function conditionEntry(name: string, conditions: Array<ENDIfStatement | ENDChooseCase>, state: CompileState, next: AstContinue): string {
    const indent = state.indent;
    const innerIndent = indent.repeat(2);

    return state.runBlock(`${name}Entry`, () => {
        return state.entity('block').mount(() => {
            const body = new SourceNode();

            conditions.forEach((block, i) => {
                if (i === 0) {
                    body.add([`if (`, generateExpression(block.test, state), ') ']);
                } else if (block.test) {
                    body.add([` else if (`, generateExpression(block.test, state), ') ']);
                } else {
                    body.add(' else ');
                }

                const blockContent = conditionContent(`${name}Body`, state, block.consequent, next);
                body.add(`{\n${innerIndent}return ${blockContent};\n${indent}}`);
            });

            return body;
        });
    });
}

/**
 * Generates contents of condition function and returns name of this function
 */
function conditionContent(name: string, state: CompileState, statements: ENDStatement[], next: AstContinue): string {
    return state.runBlock(name, block => {
        const entities = flatten(statements.map(next)) as Entity[]
        entities.forEach(entity => {
            if (entity.mountCode) {
                if (entity.type === 'element' || entity.type === 'text') {
                    entity.mountCode = sn([`${state.runtime('insert')}(${block.injector}, `, entity.mountCode, `);`]);
                } else {
                    entity.mountCode = sn(entity.mountCode);
                }
                entity.mountCode.prepend(entity.createVar());
            }
        });

        return entities;
    });
}
