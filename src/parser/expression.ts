import { Program } from './nodes';
import { eatPair } from './utils';
import Scanner from './scanner';
import parseJS from './expression/js-parser';

export const EXPRESSION_START = 123; // {
export const EXPRESSION_END = 125; // }

/**
 * Consumes expression from current stream location
 */
export default function expression(scanner: Scanner): Program {
    if (eatPair(scanner, EXPRESSION_START, EXPRESSION_END)) {
        scanner.start++;
        const begin = scanner.start;
        const end = scanner.pos - 1;

        return parseJS(scanner.substring(begin, end), scanner);
    }
}
