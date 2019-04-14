import { walk, ENDProgram }  from '@endorphinjs/template-parser';
import CompileState, { CompileStateOptions } from './compile-state';

interface ParsedTemplate {
    /** Original template source code */
    code: string,
    url?: string,
    ast: ENDProgram,
}

interface CodeWithMap {
    code: string,
    map: object
}

export function generate(ast: ENDProgram, options?: CompileStateOptions) {
    const state = new CompileState(options);

}
