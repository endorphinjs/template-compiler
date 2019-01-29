import Scanner from '../scanner';
import { ENDIfStatement, ParsedTag } from '../../ast/template';
import { tagBody, InnerStatement, expectAttributeExpression } from './utils';
import { Program } from '../../ast/expression';

/**
 * Consumes <if> statement
 * @param scanner
 * @param openTag
 */
export default function ifStatement(scanner: Scanner, openTag: ParsedTag, next: InnerStatement): ENDIfStatement {
    const test = expectAttributeExpression(scanner, openTag, 'test');
    const node = new ENDIfStatement(test.value as Program);
    node.loc = openTag.loc;
    tagBody(scanner, openTag, node.consequent, next);
    return node;
}
