import * as assert from 'assert';
import compile from '../index';

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

        assert.throws(() => compile('<template>\n\t<end:choose>\n\t\t<end:when test={foo}></end:when>\n\t\t<div></div>\n\t</end:choose>\n</template>'), {
            name: 'SyntaxError',
            rawMessage: 'Unexpected <div> tag, expecting <end:when> or <end:otherwise>'
        });
    });

    it('expression errors', () => {
        assert.throws(() => compile('<template>\n\t<end:variable foo={a +} />\n</template>'), {
            name: 'SyntaxError',
            rawMessage: 'Unexpected token',
            lineNumber: 2,
            columnNumber: 22
        });
        assert.throws(() => compile('<template>\n\t<div on:click="foo" />\n</template>'), {
            name: 'SyntaxError',
            rawMessage: 'Event handler must be expression',
            lineNumber: 2,
            columnNumber: 15
        });
    });
});
