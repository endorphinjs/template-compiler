import Scanner from '../scanner';
import { ParsedTag } from '../tag';
import { ENDAttributeStatement } from '../nodes';
import { emptyBody, InnerStatement, getAttributes } from './utils';

/**
 * Consumes <attribute> statement
 * @param scanner
 * @param openTag
 */
export default function attributeStatement(scanner: Scanner, openTag: ParsedTag, next?: InnerStatement): ENDAttributeStatement {
    const node = new ENDAttributeStatement();
    node.loc = openTag.loc;
    getAttributes(openTag).forEach(attr => node.attributes.push(attr));
    emptyBody(scanner, openTag);
    return node;
}
