import Scanner from './scanner';
import { ENDProgram, ENDStatement, ParsedTag, ENDIfStatement } from '../ast/template';
import { openTag } from './tag';
import templateStatement from './elements/template';
import ifStatement from './elements/if';
import chooseStatement from './elements/choose';
import forEachStatement from './elements/for-each';
import partialStatement from './elements/partial';
import elementStatement from './elements/element';
import attributeStatement from './elements/attribute';
import addClassStatement from './elements/add-class';
import variableStatement from './elements/variable';
import importStatement from './elements/import';
import { ignored, getControlName, InnerStatement, assertExpression, getAttrValue } from './elements/utils';
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
export default function parseToAst(scanner: Scanner): ENDProgram {
    const program = new ENDProgram();
    let entry : ParsedTag;

    while (!scanner.eof()) {
        if (entry = openTag(scanner)) {
            const name = entry.getName();
            if (name === 'template') {
                program.body.push(templateStatement(scanner, entry, statement));
            } else if (getControlName(name) == null) {
                if (name === 'link' && getAttrValue(entry, 'rel') === 'import') {
                    program.body.push(importStatement(scanner, entry));
                } else {
                    program.body.push(elementStatement(scanner, entry, statement));
                }
            } else {
                throw scanner.error(`Unexpected control statement <${entry.getName()}>`, entry);
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
    let parents: ENDIfStatement[] = [];

    // Check if open tag contains `end:if` directive. If so, wrap output into
    // `<if>` statement and remove directives
    for (let i = open.directives.length - 1; i >= 0; i--) {
        const dir = open.directives[i];
        if (dir.prefix === 'end' && dir.name.name === 'if') {
            assertExpression(scanner, dir);
            parents.push(new ENDIfStatement(dir.value as Program));
        }
    }

    if (controlName) {
        if (controlName in statements) {
            result = statements[controlName](scanner, open, statement);
        } else {
            throw scanner.error(`Unknown control statement <${open.getName()}>`, open);
        }
    } else {
        // Consume as regular tag
        result = elementStatement(scanner, open, statement);
    }

    // Wrap result with IF statements
    while (parents.length) {
        const item = parents.pop();
        item.consequent.push(result);
        result = item;
    }

    return result;
}
