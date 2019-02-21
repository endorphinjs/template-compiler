import * as assert from 'assert';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import parseJS from '../src/parser/expression/js-parser';
import Scanner from '../src/parser/scanner'
import CompileScope from '../src/codegen/scope';
import expression from '../src/codegen/expression';

function compile(code: string, scope: CompileScope = new CompileScope()): string {
    const scanner = new Scanner(code, null);
    const ast = parseJS(code, scanner);
    return expression(ast, scope).toString();
}

function read(fileName: string): string {
    return readFileSync(resolve(__dirname, fileName), 'utf8');
}

describe('Expression codegen', () => {
    it('should generate primitives', () => {
        // Primitives
        assert.equal(compile('1'), '1');
        assert.equal(compile('"foo"'), '"foo"');
        assert.equal(compile('true'), 'true');
        assert.equal(compile('null'), 'null');
        assert.equal(compile('this'), 'host');
    });

    it('should generate props & getters', () => {
        assert.equal(compile('foo'), 'host.props.foo');
        assert.equal(compile('foo.bar'), 'get(host.props.foo, "bar")');
        assert.equal(compile('foo-bar'), 'host.props["foo-bar"]');
        assert.equal(compile('foo.bar-baz'), 'get(host.props.foo, "bar-baz")');
        assert.equal(compile('foo-bar.bar-baz'), 'get(host.props["foo-bar"], "bar-baz")');
        assert.equal(compile('foo.bar[1].baz'), 'get(host.props.foo, "bar", 1, "baz")');
        assert.equal(compile('foo[bar]'), 'get(host.props.foo, host.props.bar)');
        assert.equal(compile('foo["bar"]'), 'get(host.props.foo, "bar")');
        assert.equal(compile('foo.bar[baz.bam]'), 'get(host.props.foo, "bar", get(host.props.baz, "bam"))');
        assert.equal(compile('foo[a ? b : c]'), 'get(host.props.foo, (host.props.a ? host.props.b : host.props.c))');
    });

    it('should generate state & variable accessors', () => {
        assert.equal(compile('#foo'), 'host.state.foo');
        assert.equal(compile('#foo-bar'), 'host.state["foo-bar"]');
        assert.equal(compile('@foo'), 'scope.foo');
        assert.equal(compile('@foo-bar'), 'scope["foo-bar"]');
    });

    it('should generate filters', () => {
        let scope: CompileScope;
        const toString = (scope: CompileScope) => scope.compile().toString().trim();

        assert.equal(compile('a[b => b === 1]'), 'filter(host, host.props.a, $$filter0)');

        let result = compile('a.b[c => c === 1].d.e', scope = new CompileScope());
        assert.equal(result, 'get(filter(host, get(host.props.a, "b"), $$filter0), "d", "e")');
        assert.equal(toString(scope), read('fixtures/filters/filter1.txt'));

        result = compile('a.b[({ c }) => c === foo]', scope = new CompileScope());
        assert.equal(result, 'filter(host, get(host.props.a, "b"), $$filter0)');
        assert.equal(toString(scope), read('fixtures/filters/filter2.txt'));

        result = compile('a.b[([c]) => c === foo]', scope = new CompileScope());
        assert.equal(result, 'filter(host, get(host.props.a, "b"), $$filter0)');
        assert.equal(toString(scope), read('fixtures/filters/filter3.txt'));
    });

    it('should resolve globals', () => {
        assert.equal(compile('Math.min(foo, bar)'), 'get(Math, "min")(host.props.foo, host.props.bar)');
    });

    it('should generate call expressions', () => {
        assert.equal(compile('foo()'), 'host.props.foo()');
        assert.equal(compile('foo(1, 2)'), 'host.props.foo(1, 2)');
        assert.equal(compile('foo([bar])'), 'host.props.foo([host.props.bar])');
        assert.equal(compile('foo().bar()'), 'get(host.props.foo(), "bar")()');
        assert.equal(compile('foo().bar().baz()'), 'get(get(host.props.foo(), "bar")(), "baz")()');


        const scope = new CompileScope({
            helpers: {
                '@helper-module': ['setState', 'myHelper']
            }
        });

        assert.equal(compile('setState()', scope), 'setState(host)');
        assert.equal(compile('setState({ enabled: !#enabled })', scope), 'setState(host, {enabled: !host.state.enabled})');
        assert.equal(compile('setState({ modal: null })', scope), 'setState(host, {modal: null})');
        const helpers = scope.getHelpersMap();
        assert.equal(helpers.size, 1);
        assert.deepEqual(helpers.get('@helper-module'), ['setState']);

        assert.equal(compile('$l10n("foo")', scope), 'host.store.data.l10n("foo")');
        assert.equal(compile('#l10n("foo")', scope), 'host.state.l10n("foo")');
        assert.equal(compile('$foo-bar("foo")', scope), 'host.store.data["foo-bar"]("foo")');
    });
});
