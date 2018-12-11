import Scanner from "../scanner";
import { ParsedTag } from "../tag";
import { InnerStatement, getAttr, tagBody } from "./utils";
import { Literal, ENDTemplate } from "../nodes";

/**
 * Consumes top-level <template> statement
 * @param scanner
 * @param openTag
 */
export default function templateStatement(scanner: Scanner, openTag: ParsedTag, next: InnerStatement) {
    const nameAttr = getAttr(openTag, 'name');
    let name: Literal;
    if (nameAttr && nameAttr.value instanceof Literal) {
        name = nameAttr.value;
    }
    const template = new ENDTemplate(name);
    template.loc = openTag.loc;
    tagBody(scanner, openTag, template.body, next);
    return template;
}
