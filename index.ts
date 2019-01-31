import { CodeWithSourceMap } from 'source-map';
import { ENDProgram } from './src/ast/template';
import { default as parseToAst } from './src/parser/parse';
import { default as compileToJS } from './src/codegen/template';
import { CompileScopeOptions } from './src/codegen/scope';
import { ENDCompileError, ENDSyntaxError } from './src/parser/syntax-error';

interface ParsedTemplate {
    ast: ENDProgram,
    code: string,
    url?: string
}

/**
 * Compiles given Endorphin template into JS
 * @param code Template source code
 * @param url Template file URL
 * @param options Compiler options
 */
export default function compile(code: string, url?: string, options?: CompileScopeOptions): CodeWithSourceMap {
    return generate(parse(code, url), options);
}

/**
 * Parses given Endorphin template into AST
 * @param code Template source code
 * @param url URL of source code
 */
export function parse(code: string, url?: string): ParsedTemplate {
    return { code, url, ast: parseToAst(code, url) };
}

/**
 * Generates JS code from given parsed Endorphin template AST
 * @param parsed Parsed template AST
 * @param options Compiler options
 */
export function generate(parsed: ParsedTemplate, options?: CompileScopeOptions): CodeWithSourceMap {
    try {
        const sourceMap = compileToJS(parsed.ast, options);
        sourceMap.setSourceContent(parsed.url, parsed.code);
        return sourceMap.toStringWithSourceMap({ file: parsed.url });
    } catch (err) {
        if (err instanceof ENDCompileError) {
            const { loc } = err.node;
            throw new ENDSyntaxError(err.message, parsed.url, loc && loc.start, parsed.code);
        }

        throw err;
    }
}
