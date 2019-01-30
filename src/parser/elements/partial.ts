import Scanner from "../scanner";
import { Identifier } from "../../ast/expression";
import { ENDPartialStatement, ParsedTag } from "../../ast/template";
import { tagBody, getAttributes } from "./utils";

const prefix = 'partial:';

/**
 * Consumes <partial> statement
 * @param scanner
 * @param openTag
 */
export default function partialStatement(scanner: Scanner, openTag: ParsedTag): ENDPartialStatement {
    const name = openTag.getName().slice(prefix.length);
    const start = openTag.name.loc.start.pos;
    const id = scanner.astNode(new Identifier(name), start + prefix.length, start + prefix.length + name.length);

    // Ignore partial content, if any
    tagBody(scanner, openTag, []);

    const partial = new ENDPartialStatement(id, getAttributes(openTag));
    partial.loc = openTag.loc;
    return partial;
}
