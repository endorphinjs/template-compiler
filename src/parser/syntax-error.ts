import Scanner from './scanner';
import { Position } from './nodes';

export function syntaxError(scanner: Scanner, message: string, pos: Position | number) {
    if (typeof pos === 'number') {
        pos = scanner.sourceLocation(pos);
    }

    message += ` at line ${pos.line}, column ${pos.column}`;
    if (scanner.url) {
        message += ` in ${scanner.url}`;
    }

    return new ENDSyntaxError(message, scanner.url, pos);
}

export class ENDSyntaxError extends SyntaxError {
    fileName: string | null;
    lineNumber: number;
    columnNumber: number;
    constructor(message: string, fileName: string | null, pos: Position) {
        super(message);
        this.fileName = fileName;
        this.lineNumber = pos.line;
        this.columnNumber = pos.column;
    }
}
