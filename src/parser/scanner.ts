const LF = 10;
const CR = 13;

import { Position, Node } from '../ast/base';
import { ENDSyntaxError } from './syntax-error';

export interface MatchFunction { (ch: number): boolean; }

/**
 * A streaming, character code-based string reader
 */
export default class Scanner {
    /** Current scanning position */
    pos: number;

    /** Starting location of currently parsed token */
    start: number;

    /** End of parsing content */
    end: number;

    /** Cache of lines locations in scanned content */
    lines?: number[];

    /**
     * @param string A string to consume
     * @param url Location of consumed content (e.g. url, file path etc.)
     * @param start Initial parsing location
     * @param end  Final parsing location in string
     */
    constructor(readonly string: string, readonly url: string | null, start: number = 0, end: number = string.length) {
        this.pos = this.start = start;
        this.end = end;
        this.lines = null;
    }

    /**
     * Returns true only if the stream is at the end of the file.
     */
    eof(): boolean {
        return this.pos >= this.end;
    }

    /**
     * Creates a new stream instance which is limited to given `start` and `end`
     * range. E.g. its `eof()` method will look at `end` property, not actual
     * stream end
     */
    limit(start?: number, end?: number): Scanner {
        const clone = new Scanner(this.string, this.url, start, end);
        clone.lines = this.lines;
        return clone;
    }

    /**
     * Returns the next character code in the stream without advancing it.
     * Will return NaN at the end of the file.
     */
    peek(): number {
        return this.string.charCodeAt(this.pos);
    }

    /**
     * Returns the character code located at `ahead` offset from current stream
     * position. Will return NaN at the end of the file.
     */
    peekAhead(ahead: number): number {
        // NB it looks like it’s better to override `peek()` method with `ahead`
        // argument but such method will introduce polymorphism and excessive
        // runtime checks
        return this.string.charCodeAt(this.pos + ahead);
    }

    /**
     * Returns the next character in the stream and advances it.
     * Also returns <code>undefined</code> when no more characters are available.
     */
    next(): number {
        if (this.pos < this.string.length) {
            return this.string.charCodeAt(this.pos++);
        }
    }

    /**
     * `match` can be a character code or a function that takes a character code
     * and returns a boolean. If the next character in the stream 'matches'
     * the given argument, it is consumed and returned.
     * Otherwise, `false` is returned.
     */
    eat(match: number | MatchFunction): boolean {
        const ch = this.peek();
        const ok = typeof match === 'function' ? match(ch) : ch === match;

        if (ok) {
            this.next();
        }

        return ok;
    }

    /**
     * Repeatedly calls `eat` with the given argument, until it fails.
     * Returns `true` if any characters were eaten.
     */
    eatWhile(match: number | MatchFunction): boolean {
        const start = this.pos;
        while (!this.eof() && this.eat(match)) { } // eslint-disable-line
        return this.pos !== start;
    }

    /**
     * Backs up the stream n characters. Backing it up further than the
     * start of the current token will cause things to break, so be careful.
     */
    backUp(n: number = 1): void {
        this.pos -= (n || 1);
    }

    /**
     * Get the string between the start of the current token and the
     * current stream position.
     */
    current(): string {
        return this.substring(this.start, this.pos);
    }

    /**
     * Returns substring for given range
     */
    substring(start: number, end?: number): string {
        return this.string.slice(start, end);
    }

    /**
     * Returns source location for given character position in current text stream
     */
    sourceLocation(pos: number): Position {
        if (!this.lines) {
            this.lines = getLines(this.string);
        }


        const { lines } = this;
        let line = 0;

        while (line < lines.length && pos >= lines[line]) {
            line++;
        }

        const column = pos - lines[line - 1];
        return { pos, line, column };
    }

    /**
     * Upgrades given AST node with source location info
     * @param node
     * @param start
     * @param end
     */
    astNode<T extends Node>(node: T, start: number = this.start, end: number = this.pos): T {
        node.loc = {
            source: this.url,
            start: this.sourceLocation(start),
            end: this.sourceLocation(end)
        };
        return node;
    }

    /**
     * Creates error object with current stream state
     */
    error(message: string, pos: Node | Position | number = this.pos): ENDSyntaxError {
        if (pos instanceof Node) {
            pos = pos.loc.start;
        } else if (typeof pos === 'number') {
            pos = this.sourceLocation(pos);
        }
        return new ENDSyntaxError(message, this.url, pos, this.string);
    }

    expect<T extends Node>(consumer: (scanner: Scanner) => T, error: string): T;
    expect(charCode: number, error: string): boolean;

    /**
     * Consumes node with given `consumer` and if it fails, throws error with `error` message
     */
    expect(arg: any, error: string): any {
        if (typeof arg === 'number') {
            if (this.eat(arg)) {
                return true;
            }
        } else if (typeof arg === 'function') {
            const node = arg(this);
            if (node) {
                return node;
            }
        }

        throw this.error(error);
    }
}

/**
 * Returns lines locations in given string
 */
function getLines(text: string): number[] {
    const lines = [0];
    let i = 0, ch: number;

    while (i < text.length) {
        ch = text.charCodeAt(i++);
        if (ch === LF || (ch === CR && text.charCodeAt(i) !== LF)) {
            lines.push(i);
        }
    }

    return lines;
}
