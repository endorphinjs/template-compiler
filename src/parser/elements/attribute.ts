import Scanner from '../scanner';
import { ENDAttributeStatement, ParsedTag } from '../../ast/template';
import { emptyBody, InnerStatement } from './utils';

/**
 * Consumes <attribute> statement
 * @param scanner
 * @param openTag
 */
export default function attributeStatement(scanner: Scanner, openTag: ParsedTag, next?: InnerStatement): ENDAttributeStatement {
    // TODO extract class statements
    const node = new ENDAttributeStatement(openTag.attributes, openTag.directives);
    node.loc = openTag.loc;
    emptyBody(scanner, openTag);
    return node;
}
