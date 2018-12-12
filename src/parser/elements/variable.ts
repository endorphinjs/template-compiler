import Scanner from '../scanner';
import { ParsedTag } from '../tag';
import { ENDVariableStatement, AssignmentPattern } from '../nodes';
import { emptyBody, InnerStatement, getAttributes } from './utils';

/**
 * Consumes <variable> statement
 * @param scanner
 * @param openTag
 */
export default function variableStatement(scanner: Scanner, openTag: ParsedTag, next: InnerStatement): ENDVariableStatement {
    const node = new ENDVariableStatement();
    node.loc = openTag.loc;

    getAttributes(openTag).forEach(attr => {
        node.variables.push(new AssignmentPattern(attr.name, attr.value));
    });

    emptyBody(scanner, openTag);
    return node;
}
