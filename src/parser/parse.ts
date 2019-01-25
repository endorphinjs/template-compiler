import Scanner from './scanner';
import { ENDProgram, ENDStatement, ENDIfStatement, ParsedTag } from '../ast/template';
import { openTag } from './tag';
import syntaxError from './syntax-error';
import templateStatement from './elements/template';
import ifStatement from './elements/if';
import chooseStatement from './elements/choose';
import forEachStatement from './elements/for-each';
import partialStatement from './elements/partial';
import elementStatement from './elements/element';
import attributeStatement from './elements/attribute';
import addClassStatement from './elements/add-class';
import variableStatement from './elements/variable';
import { ignored, getControlName, InnerStatement, assertExpression, getDirective } from './elements/utils';
import { Program } from '../ast/expression';

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

/**
 * Parses given Endorphin template text into AST
 * @param text Template source
 * @param url Location of source, used for source mapping
 */
export default function parse(text: string, url: string = null): ENDProgram {
    const scanner = new Scanner(text, url);
    const program = new ENDProgram();
    let entry : ParsedTag;

    while (!scanner.eof()) {
        if (entry = openTag(scanner)) {
            if (entry.getName() === 'template') {
                program.body.push(templateStatement(scanner, entry, statement));
            } else if (getControlName(entry.getName()) == null) {
                program.body.push(elementStatement(scanner, entry, statement));
            } else {
                throw syntaxError(scanner, `Unexpected control statement <${entry.getName()}>`, entry.loc.start);
            }
        } else if (!ignored(scanner, true)) {
            throw scanner.error('Unexpected token');
        }
    }

    return program;
}

/**
 * Consumes tag statement for given open tag from current scanner state
 */
function statement(scanner: Scanner, open: ParsedTag): ENDStatement {
    const controlName = getControlName(open.getName());
    let result: ENDStatement;

    if (controlName) {
        if (controlName in statements) {
            result = statements[controlName](scanner, open, statement);
        } else {
            throw syntaxError(scanner, `Unknown control statement <${open.getName()}>`, open.loc.start);
        }
    } else {
        // Consume as regular tag
        result = elementStatement(scanner, open, statement);
    }

    // Check if open tag contains `end:if` directive. If so, wrap output into
    // `<if>` statement
    const test = getDirective(open, 'end', 'if');
    if (test) {
        assertExpression(test);
        const ifStatement = new ENDIfStatement(test.value as Program);
        ifStatement.consequent.push(result);
        result = ifStatement;
    }

    return result;
}
