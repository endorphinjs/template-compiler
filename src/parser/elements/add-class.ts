import Scanner from '../scanner';
import { ParsedTag } from '../tag';
import { ENDAddClassStatement, PlainStatement } from '../nodes';
import { InnerStatement, ignored, closesTag } from './utils';
import expression from '../expression';
import text from '../text';
import syntaxError from '../syntax-error';

export default function addClassStatement(scanner: Scanner, openTag: ParsedTag, next?: InnerStatement): ENDAddClassStatement {
    if (openTag.selfClosing) {
        return;
    }

    const node = new ENDAddClassStatement();
    node.loc = openTag.loc;

    // Consume plain statements only
    let token: PlainStatement;
    while (!scanner.eof() && !closesTag(scanner, openTag)) {
        if (token = expression(scanner) || text(scanner)) {
            node.tokens.push(token);
        } else if (!ignored(scanner)) {
            throw syntaxError(scanner, `Unexpected token, <${openTag.getName()}> must contain text or expressions`);
        }
    }

    return node;
}
