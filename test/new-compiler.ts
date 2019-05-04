import * as fs from 'fs';
import * as path from 'path';
import { equal } from 'assert';
import compile from '../src/index';
import { Linter } from 'eslint';

describe('New compiler', () => {
    const linter = new Linter();
    const linterConfig = require('./fixtures/.eslintrc.js');

    function read(fileName: string): string {
        return fs.readFileSync(path.resolve(__dirname, fileName), 'utf8').trim();
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

    it.only('debug', () => {
        const samples = path.resolve(__dirname, 'samples/templates');
        const fixtures = path.resolve(__dirname, 'fixtures2/templates');
        const files = fs.readdirSync(samples);

        files.forEach(file => {
            const template = path.join(samples, file);
            const fixture = path.join(fixtures, file.replace(/\.\w+$/, '.js'));
            const output = compile(read(template), file);
            const code = output.code.trim();
            // fs.writeFileSync(fixture, code);
            equal(code, read(fixture), file);
            lint(code, file);
        });
    });
});
