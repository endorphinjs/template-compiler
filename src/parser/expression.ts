import { Expression, Literal } from './nodes';
import { eatPair } from './utils';
import Scanner from './scanner';

export const EXPRESSION_START = 123; // {
export const EXPRESSION_END = 125; // }

/**
 * Consumes expression from current stream location
 */
export default function expression(scanner: Scanner): Expression {
    if (eatPair(scanner, EXPRESSION_START, EXPRESSION_END)) {
        const begin = scanner.start + 1;
        const end = scanner.pos - 1;
        const value = scanner.substring(begin, end);

        // TODO parse expression
        return scanner.astNode(new Literal(value.trim(), value), begin, end);
    }
}
