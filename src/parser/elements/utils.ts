import Scanner from '../scanner';
import { toCharCodes, eatSection, isSpace } from '../utils';
import { Identifier, Program, Literal } from '../../ast/expression';
import { ENDStatement, ENDAttribute, ParsedTag, ENDText, ENDElement, ENDAttributeStatement } from '../../ast/template';
import { Node } from '../../ast/base';
import { closeTag, openTag } from '../tag';
import text from '../text';
import expression from '../expression';
import innerHTML from '../inner-html';

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
 */
export function tagBody(scanner: Scanner, open: ParsedTag, body: ENDStatement[], consumeTag?: InnerStatement): void {
    if (open.selfClosing) {
        // Nothing to consume in self-closing tag
        return;
    }

    const tagStack: ParsedTag[] = [open];
    const items: ENDStatement[] = [];
    let tagEntry: ParsedTag;
    let token: ENDStatement;

    while (!scanner.eof()) {
        if (closesTag(scanner, tagStack[tagStack.length - 1])) {
            tagStack.pop();
            if (!tagStack.length) {
                break;
            }
        } else if (tagEntry = openTag(scanner)) {
            if (consumeTag) {
                const inner = consumeTag(scanner, tagEntry);
                if (inner) {
                    items.push(inner);
                }
            } else {
                tagStack.push(tagEntry);
            }
        } else if (token = innerHTML(scanner) || expression(scanner) || text(scanner)) {
            items.push(token);
        } else if (!ignored(scanner)) {
            throw scanner.error(`Unexpected token`);
        }
    }

    // If we reached here then most likely we have unclosed tags
    if (tagStack.length) {
        throw scanner.error(`Expecting </${tagStack.pop().getName()}>`);
    }

    finalizeTagBody(body, items);
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
            throw scanner.error(`Unexpected token, tag <${open.getName()}> must be empty`);
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

        throw scanner.error(`Unexpected closing tag </${close.getName()}>, expecting </${open.getName()}>`, pos);
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
 */
export function getAttr(elem: ParsedTag | ENDElement | ENDAttributeStatement, name: string): ENDAttribute {
    return elem.attributes.find(attr => attr.name instanceof Identifier && attr.name.name === name);
}

/**
 * Returns value of attribute with given name from tag name definition, if any
 */
export function getAttrValue(openTag: ParsedTag | ENDElement | ENDAttributeStatement, name: string): string | number | boolean {
    const attr = getAttr(openTag, name);
    if (attr && attr.value instanceof Literal) {
        return attr.value.value;
    }
}

/**
 * Returns directive with given prefix and name from tag name definition, if any
 */
export function getDirective(openTag: ParsedTag, prefix: string, name?: string): ENDAttribute {
    return openTag.directives.find(dir => dir.prefix === prefix && (!name || dir.name.name === name));
}

/**
 * Returns list of all valid attributes from given tag, e.g. all attributes
 * except ones that have special meaning to Endorphin compiler
 */
export function getAttributes(tag: ParsedTag): ENDAttribute[] {
    return tag.attributes.filter(attr => attr.name instanceof Identifier ? !attr.name.name.startsWith(prefix) : true);
}

/**
 * Check if `tag` element contains attribute with given name and returns it. If not,
 * throws exception
 */
export function expectAttribute(scanner: Scanner, tag: ParsedTag, name: string): ENDAttribute {
    const attr = getAttr(tag, name);
    if (!attr) {
        throw scanner.error(`Expecting "${name}" attribute in <${tag.getName()}> element`, tag);
    }

    return attr;
}

export function expectAttributeExpression(scanner: Scanner, tag: ParsedTag, name: string): ENDAttribute {
    const attr = expectAttribute(scanner, tag, name);
    assertExpression(scanner, attr);
    return attr;
}

export function expectAttributeLiteral(scanner: Scanner, tag: ParsedTag, name: string): ENDAttribute {
    const attr = expectAttribute(scanner, tag, name);
    assertLiteral(scanner, attr);
    return attr;
}

/**
 * Check if value of given attribute is an expression. If not, throws exception
 */
export function assertExpression(scanner: Scanner, attr: ENDAttribute): void {
    if (!(attr.value instanceof Program)) {
        const attrName: string = attr.name instanceof Identifier ? attr.name.name : null;
        throw scanner.error(`Expecting expression as${attrName ? ` "${attrName}"` : ''} attribute value`, attr);
    }
}

/**
 * Check if value of given attribute is a literal. If not, throws exception
 */
export function assertLiteral(scanner: Scanner, attr: ENDAttribute): void {
    if (!(attr.value instanceof Literal)) {
        const attrName: string = attr.name instanceof Identifier ? attr.name.name : null;
        throw scanner.error(`Expecting string literal as${attrName ? ` "${attrName}"` : ''} attribute value`, attr);
    }
}

/**
 * Finalizes parsed body content
 */
function finalizeTagBody(parent: ENDStatement[], parsed: ENDStatement[]): void {
    removeFormatting(parsed).forEach(item => parent.push(item));
}

/**
 * Removes text formatting from given list of statements
 */
function removeFormatting(statements: ENDStatement[]): ENDStatement[] {
    return statements.filter((node, i) => {
        if (node instanceof ENDText && /[\r\n]/.test(node.value) && /^\s+$/.test(node.value)) {
            // Looks like insignificant white-space character, check if we can
            // remove it
            return isContentNode(statements[i - 1]) || isContentNode(statements[i + 1]);
        }

        return true;
    });
}

function isContentNode(node: Node): boolean {
    return node instanceof ENDText || node instanceof Program;
}
