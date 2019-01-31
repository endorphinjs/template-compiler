import Scanner from '../scanner';
import { ParsedTag, ENDImport } from '../../ast/template';
import { Literal } from '../../ast/expression';
import { expectAttributeLiteral, emptyBody } from './utils';

export default function importStatement(scanner: Scanner, openTag: ParsedTag): ENDImport {
    const tagName = expectAttributeLiteral(scanner, openTag, 'as');
    const href = expectAttributeLiteral(scanner, openTag, 'href');
    const node = new ENDImport(tagName.value as Literal, href.value as Literal);
    node.loc = openTag.loc;
    emptyBody(scanner, openTag);

    return node;
}
