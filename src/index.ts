import { walk, ENDProgram }  from '@endorphinjs/template-parser';
import CompileState, { CompileStateOptions } from './compile-state';
import { ENDCompileError, ENDSyntaxError } from './error';

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

export function generate(parsed: ParsedTemplate, options?: CompileStateOptions): CodeWithMap {
    const state = new CompileState(options);
    try {
        state.block('template', block => {

        });
        const sourceMap = state.output;

        if (parsed.url) {
            sourceMap.setSourceContent(parsed.url, parsed.code);

            const result = sourceMap.toStringWithSourceMap({ file: parsed.url });

            return {
                code: result.code,
                map: result.map.toJSON()
            };
        }

        return { code: sourceMap.toString(), map: null };

    } catch (err) {
        if (err instanceof ENDCompileError) {
            const { loc } = err.node;
            throw new ENDSyntaxError(err.message, parsed.url, loc && loc.start, parsed.code);
        }

        throw err;
    }

}
