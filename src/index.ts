import parseTemplate, { ENDProgram } from '@endorphinjs/template-parser';
import { CompileStateOptions } from './types';
import generateTemplate from './template';
import { ENDCompileError, ENDSyntaxError } from './lib/error';
import { prepareHelpers } from './lib/utils';

export interface ParsedTemplate {
    /** Original template source code */
    code: string;
    url?: string;
    ast: ENDProgram;
}

export interface CodeWithMap {
    code: string;
    map: object;
}

/**
 * Compiles given Endorphin template into JS
 * @param code Template source code
 * @param url Template file URL
 * @param options Compiler options
 */
export default function transform(code: string, url?: string, options?: CompileStateOptions): CodeWithMap {
    return generate(parse(code, url, options), options);
}

/**
 * Parses given Endorphin template into AST
 * @param code Template source code
 * @param url URL of source code
 */
export function parse(code: string, url?: string, options?: CompileStateOptions): ParsedTemplate {
    const helpers = prepareHelpers(options && options.helpers || {});
    return { code, url, ast: parseTemplate(code, url, { helpers: Object.keys(helpers) }) };
}

/**
 * Generates JS code from given parsed Endorphin template AST
 * @param parsed Parsed template AST
 * @param options Compiler options
 */
export function generate(parsed: ParsedTemplate, options?: CompileStateOptions): CodeWithMap {
    try {
        const sourceMap = generateTemplate(parsed.ast, options);

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
