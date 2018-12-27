import * as assert from 'assert';
import { parse } from '../index';
import { ENDElement, ENDText } from '../src/ast/template';
import collectStats, { ElementStats } from '../src/codegen/node-stats';

describe('Node stats', () => {
    const getElem = (code: string): ENDElement =>
        parse(code).body[0] as ENDElement;

    const getStats = (code: string): ElementStats =>
        collectStats(getElem(code));

    const isStatic = (stats: ElementStats): boolean =>
        stats.staticContent && !stats.dynamicAttributes.size && !stats.attributeExpressions;

    it('should analyze static node', () => {
        let stats: ElementStats;

        stats = getStats('<div></div>');
        assert(isStatic(stats));
        assert(!stats.component);
        assert(!stats.text);

        stats = getStats('<div>test</div>');
        assert(isStatic(stats));
        assert.equal((stats.text as ENDText).value, 'test');

        stats = getStats('<div foo="bar">test</div>');
        assert(isStatic(stats));

        stats = getStats('<my-component foo="bar">test</my-component>');
        assert(isStatic(stats));
        assert(stats.component);

        // Do no cross element boundary
        stats = getStats('<div foo="bar"><div foo={bar}></div></div>');
        assert(isStatic(stats));

        stats = getStats('<div foo="bar"><div><end:if test={foo}>test</end:if></div></div>');
        assert(isStatic(stats));
    });

    it('should analyze dynamic elements', () => {
        let stats: ElementStats;

        stats = getStats('<div foo={bar}></div>');
        assert(!isStatic(stats));
        assert.deepEqual(Array.from(stats.dynamicAttributes), ['foo']);

        stats = getStats('<div foo="{bar}"></div>');
        assert(!isStatic(stats));
        assert.deepEqual(Array.from(stats.dynamicAttributes), ['foo']);

        stats = getStats('<div>{bar}</div>');
        assert(!isStatic(stats));

        stats = getStats('<div>foo {bar}</div>');
        assert(!isStatic(stats));

        stats = getStats('<div><end:if test={foo}>bar</end:if></div>');
        assert(!isStatic(stats));

        stats = getStats('<div {foo}="bar"></div>');
        assert(!isStatic(stats));
        assert(stats.attributeExpressions);
    });
});
