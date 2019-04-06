import * as fs from 'fs';
import * as path from 'path';
import * as assert from 'assert';
import { parse } from '../index';
import { simple } from '../src/ast/walk';
import { ENDElement } from '../src/ast/template';
import { ENDPropertyIdentifier } from '../src/ast/expression';

describe('AST Walk', () => {
    function read(fileName: string): string {
        return fs.readFileSync(path.resolve(__dirname, fileName), 'utf8');
    }

    it('should perform simple walk', () => {
        const file = 'samples/template1.html';
        const { ast } = parse(read(file), file);

        const elems: string[] = [];
        const props: string[] = [];

        simple(ast, {
            ENDElement(node: ENDElement) {
                elems.push(node.name.name);
            },
            ENDPropertyIdentifier(node: ENDPropertyIdentifier) {
                props.push(node.name);
            }
        });

        assert.deepEqual(elems, ['h1', 'div']);
        assert.deepEqual(props, ['foo', 'foo']);
    });
});
