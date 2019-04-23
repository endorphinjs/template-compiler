import * as assert from 'assert';
import { parseJS } from '@endorphinjs/template-parser';
import CompileState from '../src/assets/CompileState';
import expression from '../src/expression/index';

function compile(code: string, state: CompileState = new CompileState()): string {
    const ast = parseJS(code, {
        helpers: Object.keys(state.helpers)
    });
    return expression(ast, state).toString();
}

describe.only('New Expression', () => {
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

    // it.skip('should generate filters', () => {
    //     let scope: CompileState;
    //     const toString = (scope: CompileState) => scope.compile().toString().trim();

    //     assert.equal(compile('a[b => b === 1]'), 'filter(host, host.props.a, $$filter0)');

    //     let result = compile('a.b[c => c === 1].d.e', scope = new CompileState());
    //     assert.equal(result, 'get(filter(host, get(host.props.a, "b"), $$filter0), "d", "e")');
    //     // assert.equal(toString(scope), read('fixtures/filters/filter1.txt'));

    //     result = compile('a.b[({ c }) => c === foo]', scope = new CompileState());
    //     assert.equal(result, 'filter(host, get(host.props.a, "b"), $$filter0)');
    //     // assert.equal(toString(scope), read('fixtures/filters/filter2.txt'));

    //     result = compile('a.b[([c]) => c === foo]', scope = new CompileState());
    //     assert.equal(result, 'filter(host, get(host.props.a, "b"), $$filter0)');
    //     // assert.equal(toString(scope), read('fixtures/filters/filter3.txt'));
    // });

    it('should resolve globals', () => {
        assert.equal(compile('Math.min(foo, bar)'), 'Math.min(host.props.foo, host.props.bar)');
    });

    it('should generate call expressions', () => {
        assert.equal(compile('foo()'), 'call(host.props, "foo")');
        assert.equal(compile('foo(1, 2)'), 'call(host.props, "foo", [1, 2])');
        assert.equal(compile('foo([bar])'), 'call(host.props, "foo", [[host.props.bar]])');
        assert.equal(compile('foo.bar()'), 'call(host.props.foo, "bar")');
        assert.equal(compile('foo().bar()'), 'call(call(host.props, "foo"), "bar")');
        assert.equal(compile('foo().bar().baz()'), 'call(call(call(host.props, "foo"), "bar"), "baz")');

        const state = new CompileState({
            helpers: {
                '@helper-module': ['setState', 'myHelper']
            }
        });

        assert.equal(compile('setState()', state), 'setState(host)');
        assert.equal(compile('setState({ enabled: !#enabled })', state), 'setState(host, {enabled: !host.state.enabled})');
        assert.equal(compile('setState({ modal: null })', state), 'setState(host, {modal: null})');
        const helpers = state.usedHelpers;
        assert.equal(helpers.size, 1);
        assert(helpers.has('setState'));

        assert.equal(compile('$l10n("foo")', state), 'host.store.data.l10n("foo")');
        assert.equal(compile('#l10n("foo")', state), 'call(host.state, "l10n", ["foo"])');
        assert.equal(compile('$foo-bar("foo")', state), 'host.store.data["foo-bar"]("foo")');
    });
});
