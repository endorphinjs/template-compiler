import * as fs from 'fs';
import * as path from 'path';
import * as assert from 'assert';
import { parse } from '../index';

describe('Template parser', () => {
    function read(fileName: string): string {
        return fs.readFileSync(path.resolve(__dirname, fileName), 'utf8');
    }

    it('should parse simple template', () => {
        const file = 'samples/template1.html';
        const ast = parse(read(file), file);
        const astJSON = JSON.parse(JSON.stringify(ast));
        assert.deepEqual(astJSON, JSON.parse(read('fixtures/template1-ast.json')));
    });
});
