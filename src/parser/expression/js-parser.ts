import { Parser, Node as AcornNode } from 'acorn';
import endorphinParser from './acorn-plugin';
import * as Ast from '../nodes';
import Scanner from '../scanner';
import syntaxError from '../syntax-error';

// @ts-ignore
const JSParser = Parser.extend(endorphinParser);

/**
 * Parses given JS code into AST and prepares it for Endorphin expression evaluation
 * @param code Code to parse
 * @param scanner Code location inside parsed template
 * @param sourceFile Source file URL from which expression is parsed
 */
export default function parse(code: string, scanner: Scanner): Ast.Program {
    const ast = JSParser.parse(code, {
        ecmaVersion: 2015,
        sourceType: 'module',
        sourceFile: scanner.url
    });

    return convert(ast, scanner) as Ast.Program;
}

interface AstConverter {
    (aNode: any, scanner: Scanner): Ast.Node;
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
        return new Ast.Identifier(aNode.name);
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
        // TODO convert to Endorphin deep getter
        return new Ast.MemberExpression(
            convert(aNode.object, scanner) as Ast.Expression,
            convert(aNode.property, scanner) as Ast.Expression,
            aNode.computed as boolean
        );
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
function convert(aNode: any, scanner: Scanner): Ast.Node {
    if (aNode == null) {
        return aNode;
    }

    if (!(aNode.type in converters)) {
        throw new UnsupportedError(aNode.type, aNode.start + scanner.start, aNode.end + scanner.start);
    }

    const node: Ast.Node = converters[aNode.type](aNode, scanner);
    return loc(node, aNode, scanner);
}

export class UnsupportedError extends Error {
    constructor(readonly type: string, readonly start: number, readonly end: number) {
        super('Unsupported type');
    }
}

/**
 * Adds correct source location in original text stream for given JS AST node
 */
function loc(node: Ast.Node, aNode: AcornNode, scanner: Scanner): Ast.Node {
    node.loc = {
        start: scanner.sourceLocation(aNode.start + scanner.start),
        end: scanner.sourceLocation(aNode.end + scanner.start)
    };
    return node;
}
