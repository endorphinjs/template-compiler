import Scanner from './scanner';
import { ENDProgram, Statement } from './nodes';
import tag, { ParsedTag } from './tag';
import syntaxError from './syntax-error';
import templateStatement from './elements/template';
import ifStatement from './elements/if';
import chooseStatement from './elements/choose';
import forEachStatement from './elements/for-each';
import partialStatement from './elements/partial';
import elementStatement from './elements/element';
import { ignored, getControlName } from './elements/utils';

export default function parse(text: string, url: string = null): ENDProgram {
    const scanner = new Scanner(text, url);
    const program = new ENDProgram();
    let entry : ParsedTag;

    while (!scanner.eof()) {
        // Skip unused XML entities like comments, processing instructions and
        // space characters
        if (ignored(scanner, true)) {
            continue;
        }

        if (entry = tag(scanner)) {
            if (entry.getName() === 'template') {
                program.body.push(templateStatement(scanner, entry, statement));
            } else if (getControlName(entry.getName()) == null) {
                program.body.push(elementStatement(scanner, entry, statement));
            } else {
                throw syntaxError(scanner, `Unexpected control statement <${entry.getName()}>`, entry.loc.start);
            }
        } else {
            throw scanner.error('Unexpected token');
        }
    }

    return program;
}

/**
 * Consumes tag statement for given open tag from current scanner state
 * @param scanner
 */
function statement(scanner: Scanner, openTag: ParsedTag): Statement {
    const controlName = getControlName(openTag.getName());

    if (controlName === 'if') {
        return ifStatement(scanner, openTag, statement);
    }

    if (controlName === 'choose') {
        return chooseStatement(scanner, openTag, statement);
    }

    if (controlName === 'for-each') {
        return forEachStatement(scanner, openTag, statement);
    }

    if (controlName === 'partial') {
        return partialStatement(scanner, openTag, statement);
    }

    if (controlName != null) {
        throw syntaxError(scanner, `Unknown control statement <${openTag.getName()}>`, openTag.loc.start);
    }

    // Consume as regular tag
    return elementStatement(scanner, openTag, statement);
}

