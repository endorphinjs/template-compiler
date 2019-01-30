import { Position, Node } from '../ast/base';

export class ENDSyntaxError extends SyntaxError {
    readonly fileName: string | null;
    readonly lineNumber: number;
    readonly columnNumber: number;
    readonly snippet?: string;

    constructor(message: string, fileName?: string | null, pos?: Position, source?: string) {
        if (pos) {
            message += ` at line ${pos.line}, column ${pos.column}`;
        }

        if (fileName) {
            message += ` in ${fileName}`;
        }

        let snippet: string;
        if (pos && source) {
            snippet = getSnippet(source, pos.line, pos.column);
            message += `\n\n${snippet}`;
        }

        super(message);
        this.fileName = fileName;
        this.lineNumber = pos && pos.line;
        this.columnNumber = pos && pos.column;
        this.snippet = snippet;
    }
}

export class ENDCompileError extends Error {
    constructor(message: string, readonly node: Node) {
        super(message);
    }
}

/**
 * Returns code fragment with pointer to given `line` and `column`
 */
function getSnippet(code: string, line: number, column: number): string {
    const lines = splitByLines(code);
    const start = Math.max(line - 3, 0);
    const chunk = lines.slice(start, start + 5);
    chunk.splice(line - start, 0, '-'.repeat(column) + '^^^');
    return chunk.join('\n');
}

function splitByLines(text: string): string[] {
    return text.replace(/\r\n/g, '\n').split('\n');
}
