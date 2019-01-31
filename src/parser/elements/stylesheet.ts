import Scanner from '../scanner';
import { ParsedTag, ENDStylesheet } from '../../ast/template';
import { expectAttributeLiteral, emptyBody, tagText, getAttrValueIfLiteral } from './utils';
import { Literal } from '../../ast/expression';

const defaultMIME = 'text/css';

export default function stylesheetStatement(scanner: Scanner, openTag: ParsedTag): ENDStylesheet {
    if (openTag.getName() === 'link') {
        // Process <link rel="stylesheet" />
        const href = expectAttributeLiteral(scanner, openTag, 'href').value as Literal;
        const mime = getAttrValueIfLiteral(openTag, 'type');
        emptyBody(scanner, openTag);
        return new ENDStylesheet(mime ? String(mime).trim() : defaultMIME, null, String(href.value).trim());
    }

    // Process <style> tag
    const text = tagText(scanner, openTag);
    if (text && text.value && !/^\s+$/.test(text.value)) {
        const mime = getAttrValueIfLiteral(openTag, 'type');
        return new ENDStylesheet(mime ? String(mime).trim() : defaultMIME, text, scanner.url);
    }
}
