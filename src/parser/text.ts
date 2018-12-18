import Scanner from './scanner';
import { ENDText } from '../ast/template';
import { EXPRESSION_START } from './expression';
import { TAG_START, TAG_CLOSE, nameStartChar } from './tag';

/**
 * Consumes text token from given stream
 */
export default function text(scanner: Scanner): ENDText {
    const start = scanner.pos;
    while (!scanner.eof() && !isTextBound(scanner)) {
        scanner.next();
    }

    if (start !== scanner.pos) {
        scanner.start = start;
        return scanner.astNode(new ENDText(scanner.current()));
    }
}

/**
 * Check if given stream is at tag start
 */
function isTextBound(scanner: Scanner): boolean {
    const ch = scanner.peek();

    if (ch === EXPRESSION_START) {
        return true;
    }

    // At tag start or just a lone `<` character?
    if (ch === TAG_START) {
        const ch2 = scanner.peekAhead(1);
        return nameStartChar(ch2)
            || ch2 === TAG_CLOSE
            || ch2 === 33 /* ! */
            || ch2 === 63; /* ? */
    }

    return false;
}
