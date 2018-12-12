import Scanner from "../scanner";
import { ParsedTag } from "../tag";
import { ENDPartialStatement, Identifier, AssignmentPattern } from "../nodes";
import { tagBody, InnerStatement, getAttributes } from "./utils";

const prefix = 'partial:';

/**
 * Consumes <partial> statement
 * @param scanner
 * @param openTag
 */
export default function partialStatement(scanner: Scanner, openTag: ParsedTag, next: InnerStatement): ENDPartialStatement {
    const name = openTag.getName().slice(prefix.length);
    const start = openTag.name.loc.start.pos;
    const id = scanner.astNode(new Identifier(name), start + prefix.length, start + prefix.length + name.length);

    const params: AssignmentPattern[] = [];
    getAttributes(openTag).forEach(attr => {
        params.push(new AssignmentPattern(attr.name, attr.value));
    });

    // Ignore partial content, if any
    tagBody(scanner, openTag, []);

    return new ENDPartialStatement(id, params);
}
