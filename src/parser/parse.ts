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
import { attributeStatement, addClassStatement } from './elements/attribute';
import variableStatement from './elements/variable';
import { ignored, getControlName, InnerStatement } from './elements/utils';

interface StatementMap {
    [name: string]: InnerStatement
};

const statements: StatementMap = {
    'attribute': attributeStatement,
    'add-class': addClassStatement,
    'variable': variableStatement,
    'if': ifStatement,
    'choose': chooseStatement,
    'for-each': forEachStatement,
    'partial': partialStatement
};

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
    if (controlName) {
        if (controlName in statements) {
            return statements[controlName](scanner, openTag, statement);
        }

        throw syntaxError(scanner, `Unknown control statement <${openTag.getName()}>`, openTag.loc.start);
    }

    // Consume as regular tag
    return elementStatement(scanner, openTag, statement);
}

