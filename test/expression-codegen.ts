import * as assert from 'assert';
import parseJS from '../src/parser/expression/js-parser';
import Scanner from '../src/parser/scanner'
import { expression } from '../src/codegen/expression';

function transform(code: string): string {
    const scanner = new Scanner(code, null);
    const ast = parseJS(code, scanner);
    const result = expression(ast);
    return result.code.toString();
}

describe.only('Expression codegen', () => {
    it('should generate primitives', () => {
        // Primitives
        assert.equal(transform('1'), '1');
        assert.equal(transform('"foo"'), '\'foo\'');
        assert.equal(transform('true'), 'true');
        assert.equal(transform('null'), 'null');
    });

    it('should generate props & getters', () => {
        assert.equal(transform('foo'), 'host.props.foo');
        assert.equal(transform('foo.bar'), 'get(host.props.foo, \'bar\')');
        assert.equal(transform('foo-bar'), 'host.props[\'foo-bar\']');
        assert.equal(transform('foo.bar-baz'), 'get(host.props.foo, \'bar-baz\')');
        assert.equal(transform('foo-bar.bar-baz'), 'get(host.props[\'foo-bar\'], \'bar-baz\')');
        assert.equal(transform('foo.bar[1].baz'), 'get(host.props.foo, \'bar\', 1, \'baz\')');
        assert.equal(transform('foo[bar]'), 'get(host.props.foo, host.props.bar)');
        assert.equal(transform('foo["bar"]'), 'get(host.props.foo, \'bar\')');
        assert.equal(transform('foo.bar[baz.bam]'), 'get(host.props.foo, \'bar\', get(host.props.baz, \'bam\'))');
        assert.equal(transform('foo[a ? b : c]'), 'get(host.props.foo, (host.props.a ? host.props.b : host.props.c))');
    });

    it('should generate state & variable accessors', () => {
        assert.equal(transform('#foo'), 'host.state.foo');
        assert.equal(transform('#foo-bar'), 'host.state[\'foo-bar\']');
        assert.equal(transform('$foo'), 'getVar(host, \'foo\')');
        assert.equal(transform('$foo-bar'), 'getVar(host, \'foo-bar\')');
    });

    it('should generate filters', () => {
        assert.equal(transform('a[b => b === 1]'), 'filter(host, host.props.a, filter0$$$end)');
        assert.equal(transform('a.b[c => c === 1].d.e'), 'get(filter(host, get(host.props.a, \'b\'), filter0$$$end), \'d\', \'e\')');
    });
});
