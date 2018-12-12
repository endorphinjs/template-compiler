import Scanner from '../scanner';
import tag, { ParsedTag } from '../tag';
import { ENDAttributeStatement, ENDAddClassStatement, PlainStatement } from '../nodes';
import { emptyBody, InnerStatement, getAttributes, ignored } from './utils';
import expression from '../expression';
import text from '../text';
import syntaxError from '../syntax-error';

/**
 * Consumes <attribute> statement
 * @param scanner
 * @param openTag
 */
export function attributeStatement(scanner: Scanner, openTag: ParsedTag, next: InnerStatement): ENDAttributeStatement {
    const node = new ENDAttributeStatement();
    node.loc = openTag.loc;
    getAttributes(openTag).forEach(attr => node.attributes.push(attr));
    emptyBody(scanner, openTag);
    return node;
}

export function addClassStatement(scanner: Scanner, openTag: ParsedTag, next: InnerStatement): ENDAddClassStatement {
    const node = new ENDAddClassStatement();
    node.loc = openTag.loc;

    // Consume plain statements only
    while (!scanner.eof()) {
        if (ignored(scanner)) {
            continue;
        }

        const entry: PlainStatement = expression(scanner) || text(scanner);
        if (entry) {
            node.tokens.push(entry);
            continue;
        }

        const tagEntry = tag(scanner);
        if (tagEntry && tagEntry.type === 'close' && tagEntry.getName() === openTag.getName()) {
            break;
        }

        const pos = tagEntry ? tagEntry.loc.start : scanner.sourceLocation(scanner.pos);
        throw syntaxError(scanner, `Unexpected token, <${openTag.getName()}> content must be text or expression`, pos);
    }

    return node;
}
