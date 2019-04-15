import { ENDIfStatement, ENDChooseCase, ENDStatement, ENDChooseStatement } from "@endorphinjs/template-parser";
import { SourceNode } from "source-map";
import generateExpression from "../expression";
import { BuilderContext } from "../BuilderContext";
import { AstContinue, sn } from "../utils";
import Entity from "../entity";
import { symbolBuilder } from "../builder";

/**
 * @description
 * Functions for generating condition blocks: `<if>` and `<choose>`
 */

export function conditionEntity(node: ENDIfStatement | ENDChooseStatement, next: AstContinue) {
    const conditions = node.type === 'ENDIfStatement' ? [node] : node.cases;
    return new Entity(
        node.type === 'ENDIfStatement' ? 'if' : 'choose',
        ctx => sn(`${ctx.state.runtime('mountBlock')}(${ctx.host()}, ${ctx.injector()}, ${conditionEntry(conditions, ctx, next)})`),
        symbolBuilder('updateBlock'),
        symbolBuilder('unmountBlock')
    );
}

/**
 * Generates condition entry function: tests condition and returns another function
 * for rendering matched block
 */
function conditionEntry(conditions: Array<ENDIfStatement | ENDChooseCase>, ctx: BuilderContext, next: AstContinue): string {
    const fnName = ctx.state.globalSymbol('conditionEntry');
    const indent = ctx.state.indent;
    const innerIndent = indent.repeat(2);
    const body = new SourceNode();

    conditions.forEach((block, i) => {
        if (i === 0) {
            body.add([`if (`, generateExpression(block.test, ctx), ') ']);
        } else if (block.test) {
            body.add([` else if (`, generateExpression(block.test, ctx), ') ']);
        } else {
            body.add(' else ');
        }

        const blockContent = conditionContent('conditionBody', ctx, block.consequent, next);
        body.add(`{\n${innerIndent}return ${blockContent};\n${indent}}`);
    });

    ctx.state.pushOutput(body);

    return fnName;
}

/**
 * Generates contents of condition function and returns name of this function
 */
function conditionContent(prefix: string, ctx: BuilderContext, statements: ENDStatement[], next: AstContinue): string {
    return ctx.state.block(prefix, block => {
        statements.forEach(node => next(node, ctx));
        return block.generate();
    });
}
