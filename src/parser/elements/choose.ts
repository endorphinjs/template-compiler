import Scanner from "../scanner";
import syntaxError from "../syntax-error";
import tag, { ParsedTag } from "../tag";
import { ENDChooseStatement, ENDChooseCase } from "../nodes";
import { ignored, getControlName, getAttr, tagBody, InnerStatement } from "./utils";

/**
 * Consumes <choose> statement
 * @param scanner
 * @param openTag
 */
export default function chooseStatement(scanner: Scanner, openTag: ParsedTag, next: InnerStatement): ENDChooseStatement {
    const chooseStatement = new ENDChooseStatement();
    let finished = false;
    let tagEntry: ParsedTag;

    while (!scanner.eof()) {
        // Accept <when> and <otherwise> statements only
        if (ignored(scanner, true)) {
            continue;
        }

        if (tagEntry = tag(scanner)) {
            const name = getControlName(tagEntry.getName());
            if (name !== 'when' && name !== 'otherwise') {
                throw syntaxError(scanner, `Unexpected "${tagEntry.getName()}" tag, expecting "when" or "otherwise"`, tagEntry.loc.start);
            }

            if (finished) {
                throw syntaxError(scanner, `Unexpected "${tagEntry.getName()}" after "otherwise"`, tagEntry.loc.start);
            }

            const test = getAttr(tagEntry, 'test');
            if (!test && name === 'when') {
                throw syntaxError(scanner, `Expecting "test" attribute in <${tagEntry.getName()}>`, tagEntry.loc.start);
            }

            finished = name === 'otherwise';
            const chooseCase = new ENDChooseCase(test && test.value);
            tagBody(scanner, tagEntry, chooseCase.consequent, next);
            chooseStatement.cases.push(chooseCase);
        }
    }

    return chooseStatement;
}
