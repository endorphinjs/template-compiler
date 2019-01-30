import Scanner from '../scanner';
import { ENDVariableStatement, ENDVariable, ParsedTag } from '../../ast/template';
import { emptyBody } from './utils';

/**
 * Consumes <variable> statement
 * @param scanner
 * @param openTag
 */
export default function variableStatement(scanner: Scanner, openTag: ParsedTag): ENDVariableStatement {
    const node = new ENDVariableStatement(openTag.attributes.map(attr => new ENDVariable(attr.name, attr.value)));
    node.loc = openTag.loc;
    emptyBody(scanner, openTag);
    return node;
}
