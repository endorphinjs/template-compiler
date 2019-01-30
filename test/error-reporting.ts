import * as assert from 'assert';
import { compile } from '../index';

describe('Error reporting', () => {
    it('XML errors', () => {
        assert.throws(() => compile('<div>\n\t<foo></bar>\n</div>'), {
            name: 'SyntaxError',
            message: /^Unexpected closing tag <\/bar>, expecting <\/foo> at line 2, column 6/,
            snippet: '<div>\n  <foo></bar>\n-------^\n</div>'
        });

        assert.throws(() => compile('<div>\n\t<foo a="b></foo>\n</div>'), {
            name: 'SyntaxError',
            message: /^Missing closing quote for string at line 2, column 8/,
            snippet: '<div>\n  <foo a="b></foo>\n---------^\n</div>'
        });

        assert.throws(() => compile('<template>\n\t<end:choose>\n\t\t<end:when test={foo}></end:when>\n\t\t<div></div>\n\t</end:choose>\n</template>'), {
            name: 'SyntaxError',
            message: /^Unexpected <div> tag, expecting <end:when> or <end:otherwise> at line 4, column 2/
        });
    });

    it('expression errors', () => {
        assert.throws(() => compile('<template>\n\t<end:variable foo={a +} />\n</template>'), {
            name: 'SyntaxError',
            message: /^Unexpected token at line 2, column 22/
        });
        assert.throws(() => compile('<template>\n\t<div on:click="foo" />\n</template>'), {
            name: 'SyntaxError',
            message: /^Event handler must be expression at line 2, column 15/
        });
    });
});
