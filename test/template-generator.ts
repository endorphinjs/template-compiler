import * as fs from 'fs';
import * as path from 'path';
import * as assert from 'assert';
import { Linter } from 'eslint';
import compile from '../index';

describe('Template generator', () => {
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

    it('should generate JS templates', () => {
        const samples = path.resolve(__dirname, 'samples/templates');
        const fixtures = path.resolve(__dirname, 'fixtures/templates');
        const files = fs.readdirSync(samples);

        files.forEach(file => {
            const template = read(path.join(samples, file));
            const fixture = read(path.join(fixtures, file.replace(/\.\w+$/, '.js')));
            const output = compile(template, file);
            const code = output.code.trim();
            assert.equal(code, fixture, file);
            lint(code, file);
        });
    });

    it('should use scripts', () => {
        const samples = path.resolve(__dirname, 'samples/scripts');
        const fixtures = path.resolve(__dirname, 'fixtures/scripts');
        const files = fs.readdirSync(samples);

        files.forEach(file => {
            const template = read(path.join(samples, file));
            const fixture = read(path.join(fixtures, file.replace(/\.\w+$/, '.js')));
            const output = compile(template, file);
            const code = output.code.trim();
            assert.equal(code, fixture, file);
            lint(code, file);
        });
    });
});
