import { Parser } from 'acorn';
import endorphinParser from './acorn-plugin';

// @ts-ignore
const JSParser = Parser.extend(endorphinParser);
