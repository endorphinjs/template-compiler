import { CodeWithSourceMap } from 'source-map';
import { ENDProgram } from './src/ast/template';
import { default as parseToAst } from './src/parser/parse';
import { default as compileToJS } from './src/codegen/template';
import CompileScope, { CompileScopeOptions } from './src/codegen/scope';
import Scanner from './src/parser/scanner';
import { ENDCompileError } from './src/parser/syntax-error';

/**
 * Parses given Endorphin template into AST
 * @param code Template source code
 * @param url URL of source code
 */
export function parse(code: string, url?: string): ENDProgram {
    return parseToAst(new Scanner(code, url));
}

export function compile(code: string, url?: string, options?: CompileScopeOptions): CodeWithSourceMap {
    const scanner = new Scanner(code, url);
    const scope = new CompileScope(options);
    const ast = parseToAst(scanner);
    try {
        const sourceMap = compileToJS(ast, scope);
        sourceMap.setSourceContent(url, code);
        return sourceMap.toStringWithSourceMap({ file: url });
    } catch (err) {
        if (err instanceof ENDCompileError) {
            throw scanner.error(err.message, err.node);
        } else {
            throw err;
        }
    }
}
