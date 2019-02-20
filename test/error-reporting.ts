import * as assert from 'assert';
import compile from '../index';
import { prefix } from '../src/parser/elements/utils';

describe('Error reporting', () => {
    it('XML errors', () => {
        assert.throws(() => compile('<div>\n\t<foo></bar>\n</div>'), {
            name: 'SyntaxError',
            rawMessage: 'Unexpected closing tag </bar>, expecting </foo>',
            snippet: '<div>\n  <foo></bar>\n-------^\n</div>'
        });

        assert.throws(() => compile('<div>\n\t<foo a="b></foo>\n</div>'), {
            name: 'SyntaxError',
            rawMessage: 'Missing closing quote for string',
            snippet: '<div>\n  <foo a="b></foo>\n---------^\n</div>'
        });

        assert.throws(() => compile(`<template>\n\t<${prefix}:choose>\n\t\t<${prefix}:when test={foo}></${prefix}:when>\n\t\t<div></div>\n\t</${prefix}:choose>\n</template>`), {
            name: 'SyntaxError',
            rawMessage: `Unexpected <div> tag, expecting <${prefix}:when> or <${prefix}:otherwise>`
        });
    });

    it('expression errors', () => {
        assert.throws(() => compile(`<template>\n\t<${prefix}:variable foo={a +} />\n</template>`), {
            name: 'SyntaxError',
            rawMessage: 'Unexpected token',
            lineNumber: 2,
            columnNumber: 20
        });
        assert.throws(() => compile('<template>\n\t<div on:click="foo" />\n</template>'), {
            name: 'SyntaxError',
            rawMessage: 'Event handler must be expression',
            lineNumber: 2,
            columnNumber: 15
        });
    });
});
