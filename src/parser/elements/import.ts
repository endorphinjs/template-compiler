import Scanner from '../scanner';
import { ParsedTag, ENDImport } from '../../ast/template';
import { Literal } from '../../ast/expression';
import { expectAttributeLiteral, tagBody } from './utils';

export default function importStatement(scanner: Scanner, openTag: ParsedTag): ENDImport {
    const tagName = expectAttributeLiteral(openTag, 'as');
    const href = expectAttributeLiteral(openTag, 'href');
    const node = new ENDImport(tagName.value as Literal, href.value as Literal);
    node.loc = openTag.loc;
    tagBody(scanner, openTag, []);

    return node;
}
