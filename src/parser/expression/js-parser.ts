import { Parser } from 'acorn';
import endorphinParser from './acorn-plugin';
import { Node } from '../nodes';

// @ts-ignore
const JSParser = Parser.extend(endorphinParser);

/**
 * Parses given JS code into AST and prepares it for Endorphin expression evaluation
 * @param code Code to parse
 * @param start Initial code offset in document stream
 */
export default function parse(code: string, start: number): Node {

}
