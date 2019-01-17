import Scanner from "../scanner";
import syntaxError from "../syntax-error";
import { openTag } from "../tag";
import { ENDChooseStatement, ENDChooseCase, ParsedTag, ENDAttribute } from "../../ast/template";
import { ignored, getControlName, tagBody, InnerStatement, closesTag, prefix, expectAttributeExpression } from "./utils";
import { Program } from "../../ast/expression";

/**
 * Consumes <choose> statement
 * @param scanner
 * @param open
 */
export default function chooseStatement(scanner: Scanner, open: ParsedTag, next: InnerStatement): ENDChooseStatement {
    if (open.selfClosing) {
        return;
    }

    const chooseStatement = new ENDChooseStatement();
    let finished = false;
    let tagEntry: ParsedTag;

    while (!scanner.eof() && !closesTag(scanner, open)) {
        // Accept <when> and <otherwise> statements only
        if (tagEntry = openTag(scanner)) {
            const name = getControlName(tagEntry.getName());
            if (name !== 'when' && name !== 'otherwise') {
                throw syntaxError(scanner, `Unexpected <${tagEntry.getName()}> tag, expecting <${prefix}when> or <${prefix}otherwise>`, tagEntry.loc.start);
            }

            if (finished) {
                throw syntaxError(scanner, `Unexpected <${tagEntry.getName()}> after <${prefix}otherwise>`, tagEntry.loc.start);
            }

            let test: ENDAttribute;
            if (name === 'when') {
                test = expectAttributeExpression(tagEntry, 'test');
            } else if (name === 'otherwise') {
                finished = true;
            }

            const chooseCase = new ENDChooseCase(test && (test.value as Program));
            tagBody(scanner, tagEntry, chooseCase.consequent, next);
            chooseStatement.cases.push(chooseCase);
        } else if (!ignored(scanner, true)) {
            throw syntaxError(scanner, 'Unexpected token');
        }
    }

    return chooseStatement;
}
