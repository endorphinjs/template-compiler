import parse from '@endorphinjs/template-parser';
import generateTemplate from './template';
import { ENDCompileError, ENDSyntaxError } from './error';
import { CompileStateOptions, ParsedTemplate, CodeWithMap } from './types';

export default function transform(code: string, url?: string, options?: CompileStateOptions): CodeWithMap {
    return generate({ ast: parse(code, url), code, url }, options);
}

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
