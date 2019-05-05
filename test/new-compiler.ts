import * as fs from 'fs';
import * as path from 'path';
import { equal } from 'assert';
import compile from '../src/index';
import { Linter } from 'eslint';
import { CompileStateOptions } from '../src/types';

describe('New compiler', () => {
    const baseInput = path.resolve(__dirname, './samples');
    const baseOutput = path.resolve(__dirname, './fixtures2');
    const linter = new Linter();
    const linterConfig = require('./fixtures/.eslintrc.js');

    function read(fileName: string): string {
        const absPath = path.isAbsolute(fileName) ? fileName : path.resolve(__dirname, fileName);
        return fs.readFileSync(absPath, 'utf8').trim();
    }

    function lint(code: string, filename: string) {
        const errors = linter.verify(code, linterConfig, { filename })
            .filter(item => item.fatal)
            .map(item => `${item.message} at line ${item.line}, column ${item.column}`)
            .join('\n');

        if (errors) {
            throw new Error(`Lint errors in ${filename}:\n\n${errors}`);
        }
    }

    function compare(input: string, options?: CompileStateOptions) {
        const output = input.replace(/\.html$/, '.js');
        const fileName = path.basename(input);
        const absInput = path.resolve(baseInput, input);
        const absOutput = path.resolve(baseOutput, output);
        const { code } = compile(read(absInput), fileName, options);
        // fs.writeFileSync(absOutput, code.trim());
        equal(code.trim(), read(absOutput), input);
        lint(code, fileName);
    }

    it('should generate JS templates', () => {
        const templatesDir = 'templates';
        const files = fs.readdirSync(path.join(baseInput, templatesDir));

        files.forEach(file => {
            compare(path.join(templatesDir, file));
        });
    });

    it('should use scripts', () => {
        compare('scripts/script1.html');
        compare('scripts/script2.html');
    });

    it('should export CSS scope', () => {
        compare('css-scope.html', { cssScope: 'scope123' });
    });

    it('should resolve tag name from import', () => {
        compare('imports.html');
    });

    it('should generate namespaced elements', () => {
        compare('svg.html');
    });

    // it.only('debug', () => {
    //     const { code } = compile(read('./samples/resources.html'));
    //     fs.writeFileSync(path.resolve(__dirname, './fixtures2/resources.js'), code.trim());
    //     console.log(code.trim());
    // });
});
