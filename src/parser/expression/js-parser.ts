import { Parser, Node as AcornNode } from 'acorn';
import endorphinParser from './acorn-plugin';
import { Node } from '../../ast/base';
import * as Ast from '../../ast/expression';
import Scanner from '../scanner';
import syntaxError from '../syntax-error';

// @ts-ignore
const JSParser = Parser.extend(endorphinParser);

const allowedKeywords = /^(\s*)(true|false|null|undefined)\s*;?\s*$/;

/**
 * Parses given JS code into AST and prepares it for Endorphin expression evaluation
 * @param code Code to parse
 * @param scanner Code location inside parsed template
 * @param sourceFile Source file URL from which expression is parsed
 */
export default function parse(code: string, scanner: Scanner): Ast.Program {
    const program: Ast.Program = parseKeyword(code, scanner)
        || parseScript(code, scanner);
    program.raw = code;
    return scanner.astNode(program, scanner.start, scanner.start + code.length);
}

interface AstConverter {
    (aNode: any, scanner: Scanner): Node;
}

interface AstConverterMap {
    [type: string]: AstConverter
}

const converters: AstConverterMap = {
    Program(aNode, scanner) {
        return new Ast.Program(
            aNode.body.map(expr => convert(expr, scanner)) as Ast.Statement[]
        );
    },
    Literal(aNode) {
        return new Ast.Literal(aNode.value, aNode.raw);
    },
    Identifier(aNode) {
        const name: string = aNode.name;
        if (name[0] === '#') {
            // Local state accessor
            return new Ast.ENDStateIdentifier(name.slice(1), name);
        }

        if (name[0] === '$') {
            // Runtime template variable
            return new Ast.ENDVariableIdentifier(name.slice(1), name);
        }

        if (name[0] === '@') {
            // Store property accessor
            return new Ast.ENDStoreIdentifier(name.slice(1), name);
        }

        // By default, assume we’re accessing component prop
        return new Ast.ENDPropertyIdentifier(name, name);
    },
    AssignmentPattern(aNode, scanner) {
        return new Ast.AssignmentPattern(
            convert(aNode.left, scanner) as Ast.Expression,
            convert(aNode.right, scanner) as Ast.Expression
        );
    },
    SpreadElement(aNode, scanner) {
        return new Ast.SpreadElement(convert(aNode.argument, scanner) as Ast.Expression);
    },
    RestElement(aNode, scanner) {
        return new Ast.RestElement(convert(aNode.argument, scanner) as Ast.BindingPattern);
    },
    ArrayExpression(aNode, scanner) {
        return new Ast.RestElement(convert(aNode.argument, scanner) as Ast.BindingPattern);
    },
    ObjectExpression(aNode, scanner) {
        const props: Ast.Property[] = aNode.properties.map((prop: AcornNode) => convert(prop, scanner));
        return new Ast.ObjectExpression(props);
    },
    Property(aNode, scanner) {
        return new Ast.Property(
            aNode.kind as 'init' | 'get' | 'set',
            convert(aNode.key, scanner) as Ast.PropertyKey,
            aNode.computed as boolean,
            convert(aNode.value, scanner) as Ast.Expression,
            aNode.method as boolean,
            aNode.shorthand as boolean
        );
    },
    ArrowFunctionExpression(aNode, scanner) {
        if (aNode.generator) {
            throw syntaxError(scanner, 'Generators are not supported', aNode.start + scanner.start);
        }

        if (aNode.async) {
            throw syntaxError(scanner, 'Async functions are not supported', aNode.start + scanner.start);
        }

        return new Ast.ArrowFunctionExpression(
            convert(aNode.id, scanner) as Ast.Identifier,
            aNode.params.map(param => convert(param, scanner)) as Ast.FunctionParameter[],
            convert(aNode.body, scanner) as Ast.BlockStatement | Ast.Expression,
            !!aNode.expression
        );
    },
    AssignmentExpression(aNode, scanner) {
        return new Ast.AssignmentExpression(
            aNode.operator as string,
            convert(aNode.left, scanner) as Ast.Expression,
            convert(aNode.right, scanner) as Ast.Expression
        );
    },
    BinaryExpression(aNode, scanner) {
        return new Ast.BinaryExpression(
            aNode.operator as string,
            convert(aNode.left, scanner) as Ast.Expression,
            convert(aNode.right, scanner) as Ast.Expression
        );
    },
    LogicalExpression(aNode, scanner) {
        return new Ast.LogicalExpression(
            aNode.operator as string,
            convert(aNode.left, scanner) as Ast.Expression,
            convert(aNode.right, scanner) as Ast.Expression
        );
    },
    CallExpression(aNode, scanner) {
        return new Ast.CallExpression(
            convert(aNode.callee, scanner) as Ast.Expression,
            aNode.arguments.map(arg => convert(arg, scanner)) as Ast.ArgumentListElement[]
        );
    },
    MemberExpression(aNode, scanner) {
        // Collect getter path
        const path: Ast.Expression[] = [];
        let root: Ast.ENDIdentifier;
        let ctx = aNode;

        while (ctx) {
            if (ctx.property.type === 'Identifier') {
                path.unshift(ctx.computed
                    ? convert(ctx.property, scanner) as Ast.ENDIdentifier
                    : loc(new Ast.Literal(ctx.property.name, ctx.property.name), aNode, scanner)
                );
            } else if (ctx.property.type === 'ArrowFunctionExpression') {
                throw new Error(`Filters not implemented`);
            } else {
                path.unshift(convert(ctx.property, scanner) as Ast.Expression);
            }

            if (ctx.object.type === 'MemberExpression') {
                ctx = ctx.object;
            } else {
                if (ctx.object.type === 'Identifier') {
                    root = convert(ctx.object, scanner) as Ast.ENDIdentifier;
                }
                break;
            }
        }

        if (!root) {
            throw syntaxError(scanner, `Unexpected "${aNode.object.type}" in object expression`, aNode.object.start);
        }

        return new Ast.ENDGetter(root, path);
    },
    ConditionalExpression(aNode, scanner) {
        return new Ast.ConditionalExpression(
            convert(aNode.test, scanner) as Ast.Expression,
            convert(aNode.consequent, scanner) as Ast.Expression,
            convert(aNode.alternate, scanner) as Ast.Expression
        );
    },
    RegExpLiteral(aNode, scanner) {
        return new Ast.RegExpLiteral(aNode.regex.pattern as string, aNode.regex.flags as string);
    },
    SequenceExpression(aNode, scanner) {
        return new Ast.SequenceExpression(
            aNode.expressions.map(expr => convert(expr, scanner)) as Ast.Expression[]
        );
    },
    UnaryExpression(aNode, scanner) {
        return new Ast.UnaryExpression(
            aNode.operator as string,
            convert(aNode.argument, scanner) as Ast.Expression
        );
    },
    UpdateExpression(aNode, scanner) {
        return new Ast.UpdateExpression(
            aNode.operator as string,
            convert(aNode.argument, scanner) as Ast.Expression,
            aNode.prefix as boolean
        );
    },
    ExpressionStatement(aNode, scanner) {
        return new Ast.ExpressionStatement(convert(aNode.expression, scanner) as Ast.Expression);
    },
    EmptyStatement() {
        return new Ast.EmptyStatement();
    },
    BlockStatement(aNode, scanner) {
        return new Ast.BlockStatement(
            aNode.body.map(item => convert(item, scanner)) as Ast.Statement[]
        );
    }
}

/**
 * Converts Acorn node to Endorphin node
 */
function convert(aNode: any, scanner: Scanner): Node {
    if (aNode == null) {
        return aNode;
    }

    if (!(aNode.type in converters)) {
        throw new UnsupportedError(aNode.type, aNode.start + scanner.start, aNode.end + scanner.start);
    }

    const node: Node = converters[aNode.type](aNode, scanner);
    return loc(node, aNode, scanner);
}

export class UnsupportedError extends Error {
    constructor(readonly type: string, readonly start: number, readonly end: number) {
        super(`Unsupported type ${type}`);
    }
}

/**
 * Parses code which consists of a single keyword expression to bypass Acorn
 * restriction on using single reserved literal as expression
 */
function parseKeyword(code: string, scanner: Scanner): Ast.Program {
    const m = code.match(allowedKeywords);
    if (m) {
        // Quick test to bypass Acorn restriction on using single reserved literal
        // as expression
        const offset = scanner.start + m[1].length;
        let value: boolean | null;
        if (m[2] === 'true') {
            value = true
        } else if (m[2] === 'false') {
            value = false;
        } else if (m[2] === 'null') {
            value = null;
        }

        const literal = scanner.astNode(new Ast.Literal(value, m[2]), offset, offset + m[2].length);
        return new Ast.Program([literal]);
    }
}

/**
 * Parses given JavaScript code
 */
function parseScript(code: string, scanner: Scanner): Ast.Program {
    const ast = JSParser.parse(code, {
        sourceType: 'module',
        sourceFile: scanner.url
    });
    return convert(ast, scanner) as Ast.Program;
}

/**
 * Adds correct source location in original text stream for given JS AST node
 */
function loc<T extends Node>(node: T, aNode: AcornNode, scanner: Scanner): T {
    node.loc = {
        start: scanner.sourceLocation(aNode.start + scanner.start),
        end: scanner.sourceLocation(aNode.end + scanner.start)
    };
    return node;
}
