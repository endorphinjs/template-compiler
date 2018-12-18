import Scanner from './scanner';
import { Position } from '../ast/base';

export default function syntaxError(scanner: Scanner, message: string, pos: Position | number = scanner.pos) {
    if (typeof pos === 'number') {
        pos = scanner.sourceLocation(pos);
    }

    const loc: Position = typeof pos === 'number'
        ? scanner.sourceLocation(pos)
        : pos as Position;

    message += ` at line ${loc.line}, column ${loc.column}`;
    if (scanner.url) {
        message += ` in ${scanner.url}`;
    }

    return new ENDSyntaxError(message, scanner.url, loc);
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
