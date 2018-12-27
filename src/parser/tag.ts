import expression, { EXPRESSION_START } from './expression';
import { Identifier, Literal, Program } from '../ast/expression';
import { ENDAttribute, ENDAttributeValue, ParsedTag, ENDAttributeName, ENDAttributeValueExpression, ENDBaseAttributeValue } from '../ast/template';
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

            return scanner.astNode(new ParsedTag(name, 'open', attributes, selfClosing), pos);
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
    if (name) {
        let value: ENDAttributeValue = null;

        if (scanner.eat(ATTR_DELIMITER)) {
            if (!(value = attributeValue(scanner))) {
                throw scanner.error('Expecting attribute value');
            }
        }

        return new ENDAttribute(name, value);
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
        return expr;
    }

    const start = scanner.pos;

    if (eatQuoted(scanner)) {
        // Check if it’s interpolated value, e.g. "foo {bar}"
        const raw = scanner.current();
        const node: ENDAttributeValue = raw.includes(exprStart)
            ? attributeValueExpression(scanner)
            : new Literal(raw.slice(1, -1), raw)

        return scanner.astNode(node, start);
    }

    if (scanner.eatWhile(isUnquoted)) {
        const value = scanner.current();
        return scanner.astNode(new Literal(value, value), start);
    }
}

/**
 * Parses interpolated attribute value from current scanner context
 */
function attributeValueExpression(scanner: Scanner): ENDAttributeValueExpression {
    const subScanner = scanner.limit();
    let start = subScanner.start;
    let pos = subScanner.start;
    let expr: Program;
    const items: ENDBaseAttributeValue[] = [];

    while (!subScanner.eof()) {
        pos = subScanner.pos;
        if (expr = expression(subScanner)) {
            if (pos !== start) {
                const text = subScanner.substring(start, pos);
                items.push(subScanner.astNode(new Literal(text, text), start));
            }
            items.push(subScanner.astNode(expr, start));
            start = subScanner.pos;
        } else {
            subScanner.pos++;
        }
    }

    if (start !== subScanner.pos) {
        const text = subScanner.substring(start, subScanner.pos);
        items.push(subScanner.astNode(new Literal(text, text), start));
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
