import { basename, dirname, extname } from 'path';
import Scanner from '../scanner';
import { ParsedTag, ENDImport, ENDAttribute } from '../../ast/template';
import { Literal } from '../../ast/expression';
import { expectAttributeLiteral, emptyBody, getAttr, assertLiteral } from './utils';

export default function importStatement(scanner: Scanner, openTag: ParsedTag): ENDImport {
    const href = stringValue(expectAttributeLiteral(scanner, openTag, 'href'));

    let tagName: string;
    const asAttr = getAttr(openTag, 'as');
    if (asAttr) {
        assertLiteral(scanner, asAttr);
        tagName = stringValue(asAttr);
    } else {
        // TODO provide overridable option to detect component name from import path
        const ext = extname(href);
        const fileName = basename(ext ? href.slice(0, -ext.length) : href);
        tagName = fileName.includes('-') ? fileName : basename(dirname(href));
    }

    const node = new ENDImport(tagName, href);
    node.loc = openTag.loc;
    emptyBody(scanner, openTag);

    return node;
}

function stringValue(attr: ENDAttribute): string {
    return String((attr.value as Literal).value)
}
