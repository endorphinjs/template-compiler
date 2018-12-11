import Scanner from '../scanner';
import { toCharCodes, eatSection, isSpace } from '../utils';
import { ENDText, Statement, Expression, ENDAttribute } from '../nodes';
import tag, { ParsedTag } from '../tag';
import text from '../text';
import syntaxError from '../syntax-error';
import expression from '../expression';

const cdataOpen = toCharCodes('<![CDATA[');
const cdataClose = toCharCodes(']]>');
const commentOpen = toCharCodes('<!--');
const commentClose = toCharCodes('-->');
const piOpen = toCharCodes('<?');
const piClose = toCharCodes('?>');

export interface InnerStatement {
    (scanner: Scanner, openTag: ParsedTag): Statement
}

/**
 * Consumes tag content from given scanner into `body` argument
 * @param scanner
 * @param open
 * @param body
 */
export function tagBody(scanner: Scanner, open: ParsedTag, body: Statement[], consumeTag?: InnerStatement) {
    if (open.selfClosing) {
        // Nothing to consume in self-closing tag
        return;
    }

    let textEntry: ENDText;
    let tagEntry: ParsedTag;
    let exprEntry: Expression;

    while (!scanner.eof()) {
        if (ignored(scanner)) {
            continue;
        }

        if (exprEntry = expression(scanner)) {
            body.push(exprEntry);
        } else if (textEntry = text(scanner)) {
            body.push(textEntry);
        } else if (tagEntry = tag(scanner)) {
            if (tagEntry.type === 'close') {
                if (tagEntry.getName() === open.getName()) {
                    return;
                }

                throw syntaxError(scanner, `Unexpected close tag </${tagEntry.name.name}>`, tagEntry.loc.start);
            }

            if (consumeTag) {
                const inner = consumeTag(scanner, tagEntry);
                if (inner) {
                    body.push(inner);
                }
            }
        }
    }
}

/**
 * Consumes XML sections that can be safely ignored by Endorphin
 */
export function ignored(scanner: Scanner, space?: boolean): boolean {
    return eatSection(scanner, cdataOpen, cdataClose)
        || eatSection(scanner, piOpen, piClose)
        || eatSection(scanner, commentOpen, commentClose, true)
        || (space && scanner.eatWhile(isSpace));
}

/**
 * Returns control statement name from given tag name if possible
 * @param name Tag name
 */
export function getControlName(name: string): string {
    if (name.startsWith('end:')) {
        return name.slice(4);
    }

    if (name.startsWith('partial:')) {
        return 'partial';
    }

    return null;
}

/**
 * Returns attribute with given name from tag name definition, if any
 * @param openTag
 * @param name
 */
export function getAttr(openTag: ParsedTag, name: string): ENDAttribute {
    return openTag.attributes.find(attr => attr.name.name === name);
}
