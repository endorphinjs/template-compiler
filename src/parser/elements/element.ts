import Scanner from "../scanner";
import { ENDElement, ParsedTag } from "../../ast/template";
import { tagBody, InnerStatement } from "./utils";

/**
 * Consumes regular output element
 * @param scanner
 * @param openTag
 */
export default function elementStatement(scanner: Scanner, openTag: ParsedTag, next: InnerStatement): ENDElement {
    // Consume as regular tag
    const elem = new ENDElement(openTag.name, openTag.attributes, openTag.directives);
    tagBody(scanner, openTag, elem.body, next);
    return elem;
}
