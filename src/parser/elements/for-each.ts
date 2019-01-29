import Scanner from "../scanner";
import { ENDForEachStatement, ParsedTag } from "../../ast/template";
import { getAttr, tagBody, InnerStatement, expectAttributeExpression, assertExpression } from "./utils";
import { Program } from "../../ast/expression";

/**
 * Consumes <for-each> statement
 * @param scanner
 * @param openTag
 */
export default function forEachStatement(scanner: Scanner, openTag: ParsedTag, next: InnerStatement): ENDForEachStatement {
    const select = expectAttributeExpression(scanner, openTag, 'select');
    const key = getAttr(openTag, 'key');
    if (key) {
        assertExpression(scanner, key);
    }

    // TODO parse attributes for internal variables
    const node = new ENDForEachStatement(select.value as Program, key ? key.value as Program : null);
    node.loc = openTag.loc;
    tagBody(scanner, openTag, node.body, next);
    return node;
}
