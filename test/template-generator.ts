import * as fs from 'fs';
import * as path from 'path';
import * as assert from 'assert';
import { Linter } from 'eslint';
import { compile } from '../index';

describe('Template generator', () => {
    function read(fileName: string): string {
        return fs.readFileSync(path.resolve(__dirname, fileName), 'utf8').trim();
    }

    it('should generate JS templates', () => {
        const samples = path.resolve(__dirname, 'samples/templates');
        const fixtures = path.resolve(__dirname, 'fixtures/templates');
        const files = fs.readdirSync(samples);
        const linter = new Linter();
        const linterConfig = require('./fixtures/templates/.eslintrc.js');

        files.forEach(file => {
            const template = read(path.join(samples, file));
            const fixture = read(path.join(fixtures, file.replace(/\.\w+$/, '.js')));
            const output = compile(template, file);
            const code = output.code.trim();
            assert.equal(code, fixture, file);

            const errors = linter.verify(code, linterConfig, { filename: file })
                .filter(item => item.fatal)
                .map(item => `${item.message} at line ${item.line}, column ${item.column}`)
                .join('\n');

            if (errors) {
                throw new Error(`Lint errors in ${file}:\n\n${errors}`);
            }
        });
    });
});
