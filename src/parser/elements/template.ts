import Scanner from "../scanner";
import { Identifier } from "../../ast/expression";
import { ENDTemplate, ParsedTag, ENDPartial } from "../../ast/template";
import { InnerStatement, tagBody, getDirective } from "./utils";

/**
 * Consumes top-level <template> statement
 */
export default function templateStatement(scanner: Scanner, openTag: ParsedTag, next: InnerStatement): ENDTemplate | ENDPartial {
    const partial = getDirective(openTag, 'partial');
    const template: ENDTemplate | ENDPartial = partial
        ? new ENDPartial(partial.name as Identifier, openTag.attributes)
        : new ENDTemplate();

    template.loc = openTag.loc;
    tagBody(scanner, openTag, template.body, next);
    return template;
}
