import Scanner from "../scanner";
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
    chooseStatement.loc = open.loc;
    let finished = false;
    let tagEntry: ParsedTag;

    while (!scanner.eof() && !closesTag(scanner, open)) {
        // Accept <when> and <otherwise> statements only
        if (tagEntry = openTag(scanner)) {
            const name = getControlName(tagEntry.getName());
            if (name !== 'when' && name !== 'otherwise') {
                throw scanner.error(`Unexpected <${tagEntry.getName()}> tag, expecting <${prefix}:when> or <${prefix}:otherwise>`, tagEntry);
            }

            if (finished) {
                throw scanner.error(`Unexpected <${tagEntry.getName()}> after <${prefix}:otherwise>`, tagEntry);
            }

            let test: ENDAttribute;
            if (name === 'when') {
                test = expectAttributeExpression(scanner, tagEntry, 'test');
            } else if (name === 'otherwise') {
                finished = true;
            }

            const chooseCase = new ENDChooseCase(test && (test.value as Program));
            chooseCase.loc = tagEntry.loc;
            tagBody(scanner, tagEntry, chooseCase.consequent, next);
            chooseStatement.cases.push(chooseCase);
        } else if (!ignored(scanner, true)) {
            throw scanner.error('Unexpected token');
        }
    }

    return chooseStatement;
}
