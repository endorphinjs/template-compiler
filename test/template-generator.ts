import * as fs from 'fs';
import * as path from 'path';
// import * as assert from 'assert';
import { parse, generate } from '../index';

describe('Template generator', () => {
    function read(fileName: string): string {
        return fs.readFileSync(path.resolve(__dirname, fileName), 'utf8');
    }

    it.only('should generate code for simple template', () => {
        const file = 'samples/template1.html';
        const ast = parse(read(file), file);
        const output = generate(ast);
        console.log(output.toString());

        // fs.writeFileSync(path.resolve(__dirname, 'fixtures/template1-ast.json'), JSON.stringify(ast, null, 2));
        // assert.deepEqual(astJSON, JSON.parse(read('fixtures/template1-ast.json')));
    });
});
