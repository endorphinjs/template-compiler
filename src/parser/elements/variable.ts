import Scanner from '../scanner';
import { ENDVariableStatement, ENDVariable, ParsedTag } from '../../ast/template';
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
        node.variables.push(new ENDVariable(attr.name, attr.value));
    });

    emptyBody(scanner, openTag);
    return node;
}
