import Scanner from "../scanner";
import syntaxError from "../syntax-error";
import { ParsedTag, openTag } from "../tag";
import { ENDChooseStatement, ENDChooseCase } from "../nodes";
import { ignored, getControlName, getAttr, tagBody, InnerStatement, closesTag, prefix } from "./utils";

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

            const test = getAttr(tagEntry, 'test');
            if (!test && name === 'when') {
                throw syntaxError(scanner, `Expecting "test" attribute in <${tagEntry.getName()}>`, tagEntry.loc.start);
            }

            finished = name === 'otherwise';
            const chooseCase = new ENDChooseCase(test && test.value);
            tagBody(scanner, tagEntry, chooseCase.consequent, next);
            chooseStatement.cases.push(chooseCase);
        } else if (!ignored(scanner, true)) {
            throw syntaxError(scanner, 'Unexpected token');
        }
    }

    return chooseStatement;
}
