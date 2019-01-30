import expression, { EXPRESSION_START } from './expression';
import { Identifier, Literal, Program, ExpressionStatement } from '../ast/expression';
import { ENDAttribute, ENDAttributeValue, ParsedTag, ENDAttributeName, ENDAttributeValueExpression, ENDBaseAttributeValue, ENDDirective } from '../ast/template';
import { isWhiteSpace, isQuote, eatQuoted, isAlpha, isNumber, isSpace } from './utils';
import Scanner from './scanner';

export const TAG_START = 60; // <
export const TAG_END = 62; // >
export const TAG_CLOSE = 47; // /
export const ATTR_DELIMITER = 61; // =
export const NAMESPACE_DELIMITER = 58; // :
export const DASH = 45; // -
export const DOT = 46; // .
export const UNDERSCORE = 95; // _

const exprStart = String.fromCharCode(EXPRESSION_START);
const directives = ['on', 'ref', 'end', 'class', 'partial'];

/**
 * Consumes tag from current stream location, if possible
 */
export default function tag(scanner: Scanner): ParsedTag {
    return openTag(scanner) || closeTag(scanner);
}

/**
 * Consumes open tag from given stream
 */
export function openTag(scanner: Scanner): ParsedTag {
    const pos = scanner.pos;
    if (scanner.eat(TAG_START)) {
        const name = ident(scanner);
        if (name) {
            const attributes = consumeAttributes(scanner);
            const selfClosing = scanner.eat(TAG_CLOSE);

            if (!scanner.eat(TAG_END)) {
                throw scanner.error('Expected tag closing brace');
            }

            const tag = new ParsedTag(name, 'open', selfClosing);
            attributes.forEach(attr => {
                const directive = getDirective(attr);
                if (directive) {
                    tag.directives.push(directive);
                } else {
                    // Validate some edge cases:
                    // * Currently, we do not support dynamic names in slots.
                    //   Make sure all slot names are literals
                    const attrName = attr.name instanceof Identifier ? attr.name.name : null;
                    const shouldValidateSlot = attrName === (name.name === 'slot' ? 'name' : 'slot');

                    if (shouldValidateSlot && attr.value && !(attr.value instanceof Literal)) {
                        throw scanner.error(`Slot name must be a string literal, expressions are not supported`, attr.value)
                    }

                    tag.attributes.push(attr);
                }
            });

            return scanner.astNode(tag, pos);
        }
    }

    scanner.pos = pos;
}

/**
 * Consumes close tag from given stream
 */
export function closeTag(scanner: Scanner): ParsedTag {
    const pos = scanner.pos;
    if (scanner.eat(TAG_START) && scanner.eat(TAG_CLOSE)) {
        const name = ident(scanner);
        if (name) {
            if (!scanner.eat(TAG_END)) {
                throw scanner.error('Expected tag closing brace');
            }

            return scanner.astNode(new ParsedTag(name, 'close'));
        }

        throw scanner.error('Unexpected character');
    }

    scanner.pos = pos;
}

/**
 * Check if given character can be used as a name start of tag name or attribute
 */
export function nameStartChar(ch: number): boolean {
    return isAlpha(ch) || ch === UNDERSCORE || ch === NAMESPACE_DELIMITER;
}

/**
 * Check if given character can be used as a tag name
 */
function nameChar(ch: number): boolean {
    return nameStartChar(ch) || isNumber(ch) || ch === DASH || ch === DOT;
}

/**
 * Returns `true` if valid XML identifier was consumed. If succeeded, sets stream
 * range to consumed data
 */
function ident(scanner: Scanner): Identifier {
    const start = scanner.pos;
    if (scanner.eat(nameStartChar)) {
        scanner.start = start;
        scanner.eatWhile(nameChar);

        return scanner.astNode(new Identifier(scanner.current()));
    }
}

/**
 * Consumes attributes from current stream start
 */
function consumeAttributes(scanner: Scanner): ENDAttribute[] {
    const attributes: ENDAttribute[] = [];
    let attr: ENDAttribute;
    while (!scanner.eof()) {
        scanner.eatWhile(isSpace);

        if (attr = attribute(scanner)) {
            attributes.push(attr);
        } else if (!scanner.eof() && !isTerminator(scanner.peek())) {
            throw scanner.error('Unexpected attribute name');
        } else {
            break;
        }
    }

    return attributes;
}

/**
 * Consumes attribute from current stream location
 */
function attribute(scanner: Scanner): ENDAttribute {
    const name: ENDAttributeName = ident(scanner) || expression(scanner);
    const start = scanner.pos;
    if (name) {
        let value: ENDAttributeValue = null;

        if (scanner.eat(ATTR_DELIMITER)) {
            value = scanner.expect(attributeValue, 'Expecting attribute value');
        }

        return scanner.astNode(new ENDAttribute(name, value), start);
    }
}

/**
 * Consumes attribute value from current stream location
 * @param {StreamReader} scanner
 * @return {Token}
 */
function attributeValue(scanner: Scanner): ENDAttributeValue {
    const expr = expression(scanner);
    if (expr) {
        return expandExpression(expr);
    }

    const start = scanner.pos;

    if (eatQuoted(scanner)) {
        // Check if it’s interpolated value, e.g. "foo {bar}"
        const raw = scanner.current();
        if (raw.includes(exprStart)) {
            const attrExpression = attributeValueExpression(scanner.limit(scanner.start + 1, scanner.pos - 1));
            if (attrExpression.elements.length === 1) {
                return attrExpression.elements[0];
            }

            return scanner.astNode(attrExpression, start);
        }

        return scanner.astNode(new Literal(raw.slice(1, -1), raw), start);
    }

    if (scanner.eatWhile(isUnquoted)) {
        scanner.start = start;
        const value = scanner.current();
        return scanner.astNode(new Literal(value, value), start);
    }
}

/**
 * Parses interpolated attribute value from current scanner context
 */
function attributeValueExpression(scanner: Scanner): ENDAttributeValueExpression {
    let start = scanner.start;
    let pos = scanner.start;
    let expr: Program;
    const items: ENDBaseAttributeValue[] = [];

    while (!scanner.eof()) {
        pos = scanner.pos;
        if (expr = expression(scanner)) {
            if (pos !== start) {
                const text = scanner.substring(start, pos);
                items.push(scanner.astNode(new Literal(text, text), start));
            }
            items.push(scanner.astNode(expr, start));
            start = scanner.pos;
        } else {
            scanner.pos++;
        }
    }

    if (start !== scanner.pos) {
        const text = scanner.substring(start, scanner.pos);
        items.push(scanner.astNode(new Literal(text, text), start));
    }

    return new ENDAttributeValueExpression(items);
}

/**
 * Check if given code is tag terminator
 */
function isTerminator(code: number): boolean {
    return code === TAG_END || code === TAG_CLOSE;
}

/**
 * Check if given character code is valid unquoted value
 */
function isUnquoted(code: number): boolean {
    return !isNaN(code) && !isQuote(code) && !isWhiteSpace(code)
        && !isTerminator(code) && code !== ATTR_DELIMITER && code !== EXPRESSION_START;
}

/**
 * If given attribute is a directive (has one of known prefixes), converts it to
 * directive token, returns `null` otherwise
 */
function getDirective(attr: ENDAttribute): ENDDirective {
    if (attr.name instanceof Identifier) {
        const m = attr.name.name.match(/^([\w-]+):/);

        if (m && directives.includes(m[1])) {
            const prefix = m[1];
            const { name, loc } = attr.name;
            const directiveId = new Identifier(name.slice(m[0].length));
            directiveId.loc = {
                ...loc,
                start: {
                    ...loc.start,
                    column: loc.start.column + m[0].length
                }
            };

            return new ENDDirective(prefix, directiveId, attr.value);
        }
    }
}

/**
 * Detects if given expression is a single literal and returns it
 */
function expandExpression(expr: Program): Program | Literal {
    if (expr.body.length === 1 && expr.body[0] instanceof ExpressionStatement) {
        const inner = expr.body[0] as ExpressionStatement;
        if (inner.expression instanceof Literal) {
            return inner.expression;
        }
    }

    return expr;
}
