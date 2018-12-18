import Scanner from "../scanner";
import syntaxError from "../syntax-error";
import { ENDForEachStatement, ParsedTag } from "../../ast/template";
import { getAttr, tagBody, InnerStatement } from "./utils";

/**
 * Consumes <for-each> statement
 * @param scanner
 * @param openTag
 */
export default function forEachStatement(scanner: Scanner, openTag: ParsedTag, next: InnerStatement): ENDForEachStatement {
    const select = getAttr(openTag, 'select');
    if (!select) {
        throw syntaxError(scanner, `Expecting "select" attribute in <for-each> statement`, openTag.name.loc.start);
    }

    // TODO parse `select` as expression
    // TODO parse attributes for internal variables
    const node = new ENDForEachStatement(select.value);
    node.loc = openTag.loc;
    tagBody(scanner, openTag, node.body, next);
    return node;
}
