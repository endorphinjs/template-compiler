import Scanner from '../scanner';
import syntaxError from '../syntax-error';
import { ENDIfStatement, ParsedTag } from '../../ast/template';
import { getAttr, tagBody, InnerStatement } from './utils';

/**
 * Consumes <if> statement
 * @param scanner
 * @param openTag
 */
export default function ifStatement(scanner: Scanner, openTag: ParsedTag, next: InnerStatement): ENDIfStatement {
    const test = getAttr(openTag, 'test');
    if (!test) {
        throw syntaxError(scanner, `Expecting "test" attribute in <${openTag.getName()}> statement`, openTag.name.loc.start);
    }

    // TODO parse `test` as expression
    const node = new ENDIfStatement(test.value);
    node.loc = openTag.loc;
    tagBody(scanner, openTag, node.consequent, next);
    return node;
}
