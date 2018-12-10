import Scanner from './scanner';
import { toCharCodes, eatSection, isSpace } from './utils';
import { ENDTemplate, ENDProgram, ENDElement, ENDText, Statement, ENDIfStatement, Literal, Expression, ENDForEachStatement, ENDChooseCase, ENDChooseStatement, ENDPartialStatement, Identifier, AssignmentPattern, ENDAttribute } from './nodes';
import tag, { ParsedTag } from './tag';
import text from './text';
import { syntaxError } from './syntax-error';
import expression from './expression';

const cdataOpen = toCharCodes('<![CDATA[');
const cdataClose = toCharCodes(']]>');
const commentOpen = toCharCodes('<!--');
const commentClose = toCharCodes('-->');
const piOpen = toCharCodes('<?');
const piClose = toCharCodes('?>');

export default function parse(text: string, url: string = null): ENDProgram {
    const scanner = new Scanner(text, url);
    const program = new ENDProgram();
    let entry : ParsedTag;

    while (!scanner.eof()) {
        // Skip unused XML entities like comments, processing instructions and
        // space characters
        if (consumeIgnored(scanner) || scanner.eatWhile(isSpace)) {
            continue;
        }

        if (entry = tag(scanner)) {
            if (entry.getName() === 'template') {
                program.body.push(consumeTemplateStatement(scanner, entry));
            } else if (getControlName(entry.getName()) == null) {
                program.body.push(consumeElementStatement(scanner, entry));
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
 * Consumes top-level <template> statement
 * @param scanner
 * @param openTag
 */
function consumeTemplateStatement(scanner: Scanner, openTag: ParsedTag) {
    const nameAttr = getAttr(openTag, 'name');
    let name: Literal;
    if (nameAttr && nameAttr.value instanceof Literal) {
        name = nameAttr.value;
    }
    const template = new ENDTemplate(name);
    template.loc = openTag.loc;
    consumeTagBody(scanner, openTag, template.body);
    return template;
}

/**
 * Consumes tag content from given scanner into `body` argument
 * @param scanner
 * @param open
 * @param body
 */
function consumeTagBody(scanner: Scanner, open: ParsedTag, body: Statement[]) {
    if (open.selfClosing) {
        // Nothing to consume in self-closing tag
        return;
    }

    let textEntry: ENDText;
    let tagEntry: ParsedTag;
    let exprEntry: Expression;

    while (!scanner.eof()) {
        if (consumeIgnored(scanner)) {
            continue;
        }

        if (exprEntry = expression(scanner)) {
            body.push(exprEntry);
        } else if (textEntry = text(scanner)) {
            body.push(textEntry);
        } else if (tagEntry = tag(scanner)) {
            if (tagEntry.type === 'close') {
                if (tagEntry.getName() === open.getName()) {
                    return;
                }

                throw syntaxError(scanner, `Unexpected close tag </${tagEntry.name.name}>`, tagEntry.loc.start);
            }

            body.push(consumeTagStatement(scanner, tagEntry));
        }
    }
}

/**
 * Consumes tag statement for given open tag from current scanner state
 * @param scanner
 */
function consumeTagStatement(scanner: Scanner, openTag: ParsedTag): Statement {
    const controlName = getControlName(openTag.getName());

    if (controlName === 'if') {
        return consumeIfStatement(scanner, openTag);
    }

    if (controlName === 'choose') {
        return consumeChooseStatement(scanner, openTag);
    }

    if (controlName === 'for-each') {
        return consumeForEachStatement(scanner, openTag);
    }

    if (controlName === 'partial') {
        return consumePartialStatement(scanner, openTag);
    }

    if (controlName != null) {
        throw syntaxError(scanner, `Unknown control statement <${openTag.getName()}>`, openTag.loc.start);
    }

    // Consume as regular tag
    return consumeElementStatement(scanner, openTag);
}
/**
 * Consumes regular output element
 * @param scanner
 * @param openTag
 */
function consumeElementStatement(scanner: Scanner, openTag: ParsedTag): ENDElement {
    // Consume as regular tag
    const elem = new ENDElement(openTag.name, openTag.attributes);
    consumeTagBody(scanner, openTag, elem.body);
    return elem;
}

/**
 * Consumes <if> statement
 * @param scanner
 * @param openTag
 */
function consumeIfStatement(scanner: Scanner, openTag: ParsedTag): ENDIfStatement {
    const test = getAttr(openTag, 'test');
    if (!test) {
        throw syntaxError(scanner, `Expecting "test" attribute in <if> statement`, openTag.name.loc.start);
    }

    // TODO parse `test` as expression
    const ifStatement = new ENDIfStatement(test.value);
    ifStatement.loc = openTag.loc;
    consumeTagBody(scanner, openTag, ifStatement.consequent);
    return ifStatement;
}

/**
 * Consumes <for-each> statement
 * @param scanner
 * @param openTag
 */
function consumeForEachStatement(scanner: Scanner, openTag: ParsedTag): ENDForEachStatement {
    const select = getAttr(openTag, 'select');
    if (!select) {
        throw syntaxError(scanner, `Expecting "select" attribute in <for-each> statement`, openTag.name.loc.start);
    }

    // TODO parse `select` as expression
    // TODO parse attributes for internal variables
    const forEachStatement = new ENDForEachStatement(select.value);
    forEachStatement.loc = openTag.loc;
    consumeTagBody(scanner, openTag, forEachStatement.body);
    return forEachStatement;
}

/**
 * Consumes <choose> statement
 * @param scanner
 * @param openTag
 */
function consumeChooseStatement(scanner: Scanner, openTag: ParsedTag): ENDChooseStatement {
    const chooseStatement = new ENDChooseStatement();
    let finished = false;
    let tagEntry: ParsedTag;

    while (!scanner.eof()) {
        // Accept <when> and <otherwise> statements only
        if (consumeIgnored(scanner) || scanner.eatWhile(isSpace)) {
            continue;
        }

        if (tagEntry = tag(scanner)) {
            const name = getControlName(tagEntry.getName());
            if (name !== 'when' && name !== 'otherwise') {
                throw syntaxError(scanner, `Unexpected "${tagEntry.getName()}" tag, expecting "when" or "otherwise"`, tagEntry.loc.start);
            }

            if (finished) {
                throw syntaxError(scanner, `Unexpected "${tagEntry.getName()}" after "otherwise"`, tagEntry.loc.start);
            }

            const test = getAttr(tagEntry, 'test');
            if (!test && name === 'when') {
                throw syntaxError(scanner, `Expecting "test" attribute in <${tagEntry.getName()}>`, tagEntry.loc.start);
            }

            finished = name === 'otherwise';
            const chooseCase = new ENDChooseCase(test && test.value);
            consumeTagBody(scanner, tagEntry, chooseCase.consequent);
            chooseStatement.cases.push(chooseCase);
        }
    }

    return chooseStatement;
}

/**
 * Consumes <partial> statement
 * @param scanner
 * @param openTag
 */
function consumePartialStatement(scanner: Scanner, openTag: ParsedTag): ENDPartialStatement {
    const prefix = 'partial:';
    const name = openTag.getName().slice(prefix.length);
    const start = openTag.name.loc.start.pos;
    const id = scanner.astNode(new Identifier(name), start + prefix.length, start + prefix.length + name.length);

    const params: AssignmentPattern[] = [];
    openTag.attributes.forEach(attr => {
        params.push(new AssignmentPattern(attr.name, attr.value));
    });

    // Ignore partial content, if any
    consumeTagBody(scanner, openTag, []);

    return new ENDPartialStatement(id, params);
}

/**
 * Consumes ignored section
 * @param scanner
 */
function consumeIgnored(scanner: Scanner): boolean {
    return eatSection(scanner, cdataOpen, cdataClose)
        || eatSection(scanner, piOpen, piClose)
        || eatSection(scanner, commentOpen, commentClose, true);
}

/**
 * Returns control statement name from given tag name if possible
 * @param name Tag name
 */
function getControlName(name: string): string {
    if (name.startsWith('end:')) {
        return name.slice(4);
    }

    if (name.startsWith('partial:')) {
        return 'partial';
    }

    return null;
}

/**
 * Returns attribute with given name from tag name definition, if any
 * @param openTag
 * @param name
 */
function getAttr(openTag: ParsedTag, name: string): ENDAttribute {
    return openTag.attributes.find(attr => attr.name.name === name);
}
