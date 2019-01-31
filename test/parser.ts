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
        const { ast } = parse(read(file), file);
        const astJSON = JSON.parse(JSON.stringify(ast));
        // fs.writeFileSync(path.resolve(__dirname, 'fixtures/template1-ast.json'), JSON.stringify(ast, null, 2));
        assert.deepEqual(astJSON, JSON.parse(read('fixtures/template1-ast.json')));
    });

    it('should parse styles & scripts', () => {
        const file = 'samples/resources.html';
        const { ast } = parse(read(file), file);

        assert.equal(ast.filename, file);

        // Should omit empty styles and scripts
        assert.equal(ast.stylesheets.length, 3);
        assert.equal(ast.scripts.length, 2);

        assert.equal(ast.stylesheets[0].content, null);
        assert.equal(ast.stylesheets[0].url, './style.css');
        assert.equal(ast.stylesheets[0].mime, 'text/css');

        assert.equal(ast.stylesheets[1].content, null);
        assert.equal(ast.stylesheets[1].url, '/style.scss');
        assert.equal(ast.stylesheets[1].mime, 'scss');

        assert.equal(ast.stylesheets[2].content.value, '\n    .foo { padding: 10px; }\n');
        assert.deepEqual(ast.stylesheets[2].content.loc, {
            source: file,
            start: { line: 3, column: 7, pos: 109 },
            end: { line: 5, column: 0, pos: 138 }
        });
        assert.equal(ast.stylesheets[2].url, file);
        assert.equal(ast.stylesheets[2].mime, 'text/css');

        assert.equal(ast.scripts[0].content.value, 'var foo = \'<p>hello world</p>\';');
        assert.deepEqual(ast.scripts[0].content.loc, {
            source: file,
            start: { line: 7, column: 8, pos: 171 },
            end: { line: 7, column: 39, pos: 202 }
        });
        assert.equal(ast.scripts[0].url, file);
        assert.equal(ast.scripts[0].mime, 'text/javascript');
    });
});
