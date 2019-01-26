import Scanner from "../scanner";
import { ENDElement, ParsedTag, ENDStatement, ENDAddClassStatement, ENDText, ENDIfStatement } from "../../ast/template";
import { tagBody, InnerStatement, assertExpression } from "./utils";
import { Program } from "../../ast/expression";

/**
 * Consumes regular output element
 * @param scanner
 * @param openTag
 */
export default function elementStatement(scanner: Scanner, openTag: ParsedTag, next: InnerStatement): ENDStatement {
    // Consume as regular tag
    const elem = new ENDElement(openTag.name, openTag.attributes, openTag.directives);
    tagBody(scanner, openTag, elem.body, next);
    return expandDirectives(elem);
}

/**
 * Expands directives in given element: replaces some known directives with AST nodes
 */
function expandDirectives(elem: ENDElement): ENDStatement {
    let ctx: ENDStatement = elem;

    for (let i = elem.directives.length - 1; i >= 0; i--) {
        const dir = elem.directives[i];

        if (dir.prefix === 'class') {
            // Expand `class:name={expr} directives
            const className = new ENDText(dir.name.name);
            className.loc = dir.name.loc;
            const classStatement = new ENDAddClassStatement();
            classStatement.loc = dir.loc;
            classStatement.tokens.push(className);

            if (dir.value !== null) {
                assertExpression(dir);
                const ifStatement = new ENDIfStatement(dir.value as Program);
                ifStatement.consequent.push(classStatement);
                elem.body.unshift(ifStatement);
            } else {
                elem.body.unshift(classStatement);
            }
            elem.directives.splice(i, 1);
        }
    }

    return ctx;
}
