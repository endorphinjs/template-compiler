import Scanner from '../scanner';
import { toCharCodes, eatSection, isSpace } from '../utils';
import { Identifier } from '../../ast/expression';
import { ENDStatement, ENDAttribute, ParsedTag } from '../../ast/template';
import { closeTag, openTag } from '../tag';
import text from '../text';
import syntaxError from '../syntax-error';
import expression from '../expression';

const cdataOpen = toCharCodes('<![CDATA[');
const cdataClose = toCharCodes(']]>');
const commentOpen = toCharCodes('<!--');
const commentClose = toCharCodes('-->');
const piOpen = toCharCodes('<?');
const piClose = toCharCodes('?>');

/**
 * A prefix for Endorphin element and attribute names
 */
export const prefix = 'end:';

export interface InnerStatement {
    (scanner: Scanner, openTag: ParsedTag, next?: InnerStatement): ENDStatement
}

/**
 * Consumes tag content from given scanner into `body` argument
 * @param scanner
 * @param open
 * @param body
 */
export function tagBody(scanner: Scanner, open: ParsedTag, body: ENDStatement[], consumeTag?: InnerStatement): void {
    if (open.selfClosing) {
        // Nothing to consume in self-closing tag
        return;
    }

    const tagStack: ParsedTag[] = [open];
    let tagEntry: ParsedTag;
    let token: ENDStatement;

    while (!scanner.eof()) {
        if (closesTag(scanner, tagStack[tagStack.length - 1])) {
            tagStack.pop();
            if (!tagStack.length) {
                return;
            }
        } else if (tagEntry = openTag(scanner)) {
            if (consumeTag) {
                const inner = consumeTag(scanner, tagEntry);
                if (inner) {
                    body.push(inner);
                }
            } else {
                tagStack.push(tagEntry);
            }
        } else if (token = expression(scanner) || text(scanner)) {
            body.push(token);
        } else if (!ignored(scanner)) {
            throw syntaxError(scanner, `Unexpected token`);
        }
    }

    // If we reached here then most likely we have unclosed tags
    if (tagStack.length) {
        throw syntaxError(scanner, `Expecting </${tagStack.pop().getName()}>`);
    }
}

/**
 * Consumes tag content and ensures it’s empty, e.g. no meaningful data in it,
 * or throw exception
 * @param scanner
 * @param open
 */
export function emptyBody(scanner: Scanner, open: ParsedTag): void {
    if (open.selfClosing) {
        // Nothing to consume in self-closing tag
        return;
    }

    while (!scanner.eof() && !closesTag(scanner, open)) {
        if (!ignored(scanner)) {
            throw syntaxError(scanner, `Unexpected token, tag <${open.getName()}> must be empty`);
        }
    }
}

/**
 * Check if next token in current scanner state is a closing tag for given `open` one
 */
export function closesTag(scanner: Scanner, open: ParsedTag): boolean {
    const pos = scanner.pos;
    const close = closeTag(scanner);
    if (close) {
        if (close.getName() === open.getName()) {
            return true;
        }

        throw syntaxError(scanner, `Unexpected closing tag <${close.getName()}>, expecting </${open.getName()}>`, pos);
    }

    return false;
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
    if (name.startsWith(prefix)) {
        return name.slice(prefix.length);
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
    return openTag.attributes.find(attr => attr.name instanceof Identifier && attr.name.name === name);
}

/**
 * Returns list of all valid attributes from given tag, e.g. all attributes
 * except ones that have special meaning to Endorphin compiler
 */
export function getAttributes(tag: ParsedTag): ENDAttribute[] {
    return tag.attributes.filter(attr => attr.name instanceof Identifier ? !attr.name.name.startsWith(prefix) : true);
}
