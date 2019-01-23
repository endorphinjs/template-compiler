import * as fs from 'fs';
import * as path from 'path';
// import * as assert from 'assert';
import { parse, generate } from '../index';

describe('Template generator', () => {
    function read(fileName: string): string {
        return fs.readFileSync(path.resolve(__dirname, fileName), 'utf8');
    }

    it.only('should generate JS templates', () => {
        const samples = path.resolve(__dirname, 'samples/templates');
        const fixtures = path.resolve(__dirname, 'fixtures/templates');
        const files = fs.readdirSync(samples);
        files.forEach(file => {
            const ast = parse(read(path.join(samples, file)), file);
            const output = generate(ast);
            fs.writeFileSync(path.join(fixtures, file.replace(/\.\w+$/, '.js')), output.toString());
        });

        // const file = 'samples/template1.html';
        // const ast = parse(read(file), file);
        // const output = generate(ast);

        // fs.writeFileSync(path.resolve(__dirname, 'fixtures/templates/template1.js'), output.toString());
        // console.log(output.toString());

        // fs.writeFileSync(path.resolve(__dirname, 'fixtures/template1-ast.json'), JSON.stringify(ast, null, 2));
        // assert.deepEqual(astJSON, JSON.parse(read('fixtures/template1-ast.json')));
    });
});
