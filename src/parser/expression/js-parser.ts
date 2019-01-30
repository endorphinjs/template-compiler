import { Parser, Node as AcornNode } from 'acorn';
import endorphinParser from './acorn-plugin';
import { Node } from '../../ast/base';
import * as Ast from '../../ast/expression';
import Scanner from '../scanner';

// @ts-ignore
const JSParser = Parser.extend(endorphinParser);

const allowedKeywords = /^(\s*)(true|false|null|undefined|this)\s*;?\s*$/;

class Scope {
    private reserved: Set<string> = new Set();
    private stack: Set<string>[] = [];

    enter(): void {
        this.stack.push(this.reserved);
        this.reserved = new Set(this.reserved);
    }

    exit(): void {
        this.reserved = this.stack.pop();
    }

    reserve(name: string): void {
        this.reserved.add(name);
    }

    isReserved(name: string): boolean {
        return this.reserved.has(name);
    }
}

/**
 * Parses given JS code into AST and prepares it for Endorphin expression evaluation
 * @param code Code to parse
 * @param scanner Code location inside parsed template
 * @param sourceFile Source file URL from which expression is parsed
 */
export default function parse(code: string, scanner: Scanner): Ast.Program {
    const program = parseKeyword(code, scanner) || parseScript(code, scanner);
    program.raw = code;
    return scanner.astNode(program, scanner.start, scanner.start + code.length);
}

interface AstConverter {
    (aNode: any, scope: Scope, scanner: Scanner, next: (aNode: any) => Node): Node;
}

interface AstConverterMap {
    [type: string]: AstConverter
}

const converters: AstConverterMap = {
    Program(aNode, scope, scanner, next) {
        return new Ast.Program(aNode.body.map(next) as Ast.Statement[]);
    },
    Literal(aNode) {
        return new Ast.Literal(aNode.value, aNode.raw);
    },
    Identifier(aNode, scope) {
        const name: string = aNode.name;

        // Identifier is reserved, most likely by outer function argument
        if (scope.isReserved(name)) {
            return new Ast.Identifier(name);
        }

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
    AssignmentPattern(aNode, scope, scanner, next) {
        return new Ast.AssignmentPattern(
            next(aNode.left) as Ast.Expression,
            next(aNode.right) as Ast.Expression
        );
    },
    SpreadElement(aNode, scope, scanner, next) {
        return new Ast.SpreadElement(next(aNode.argument) as Ast.Expression);
    },
    RestElement(aNode, scope, scanner, next) {
        return new Ast.RestElement(next(aNode.argument) as Ast.BindingPattern);
    },
    ArrayExpression(aNode, scope, scanner, next) {
        return new Ast.ArrayExpression(aNode.elements.map(next) as Ast.ArrayPatternElement[]);
    },
    ArrayPattern(aNode, scope, scanner, next) {
        return new Ast.ArrayExpression(aNode.elements.map(next) as Ast.ArrayPatternElement[]);
    },
    ObjectExpression(aNode, scope, scanner, next) {
        const props: Ast.Property[] = aNode.properties.map(next);
        return new Ast.ObjectExpression(props);
    },
    ObjectPattern(aNode, scope, scanner, next) {
        const props: Ast.Property[] = aNode.properties.map(next);
        return new Ast.ObjectExpression(props);
    },
    Property(aNode, scope, scanner, next) {
        return new Ast.Property(
            aNode.kind as 'init' | 'get' | 'set',
            next(aNode.key) as Ast.PropertyKey,
            aNode.computed as boolean,
            next(aNode.value) as Ast.Expression,
            aNode.method as boolean,
            aNode.shorthand as boolean
        );
    },
    ArrowFunctionExpression(aNode, scope, scanner, next) {
        if (aNode.generator || aNode.async) {
            throw scanner.error('Generators and async functions are not supported', aNode.start + scanner.start);
        }

        // Rewrite arrow function body: function arguments must be kept as-is (identifiers)
        // while others should be changed to variables, props and state
        scope.enter();
        aNode.params.forEach(param => walkParam(param, scope));

        const result = new Ast.ArrowFunctionExpression(
            next(aNode.id) as Ast.Identifier,
            aNode.params.map(next) as Ast.FunctionParameter[],
            next(aNode.body) as Ast.BlockStatement | Ast.Expression,
            !!aNode.expression
        );

        scope.exit();
        return result;
    },
    AssignmentExpression(aNode, scope, scanner, next) {
        return new Ast.AssignmentExpression(
            aNode.operator as string,
            next(aNode.left) as Ast.Expression,
            next(aNode.right) as Ast.Expression
        );
    },
    BinaryExpression(aNode, scope, scanner, next) {
        return new Ast.BinaryExpression(
            aNode.operator as string,
            next(aNode.left) as Ast.Expression,
            next(aNode.right) as Ast.Expression
        );
    },
    LogicalExpression(aNode, scope, scanner, next) {
        return new Ast.LogicalExpression(
            aNode.operator as string,
            next(aNode.left) as Ast.Expression,
            next(aNode.right) as Ast.Expression
        );
    },
    CallExpression(aNode, scope, scanner, next) {
        return new Ast.CallExpression(
            next(aNode.callee) as Ast.Expression,
            aNode.arguments.map(next) as Ast.ArgumentListElement[]
        );
    },
    MemberExpression(aNode, scope, scanner, next) {
        // Collect getter path
        const path: Ast.Expression[] = [];
        let root: Ast.ENDIdentifier | Ast.ENDFilter;
        let ctx = aNode;

        while (ctx) {
            if (ctx.property.type === 'Identifier') {
                path.unshift(ctx.computed
                    ? next(ctx.property) as Ast.ENDIdentifier
                    : loc(new Ast.Literal(ctx.property.name, ctx.property.name), aNode, scanner)
                );
            } else if (ctx.property.type === 'ArrowFunctionExpression') {
                root = loc(new Ast.ENDFilter(
                    next(ctx.object) as Ast.Expression,
                    next(ctx.property) as Ast.ArrowFunctionExpression
                ), ctx.property, scanner);
                break;
            } else {
                path.unshift(next(ctx.property) as Ast.Expression);
            }

            if (ctx.object.type === 'MemberExpression') {
                ctx = ctx.object;
            } else {
                if (ctx.object.type === 'Identifier') {
                    root = next(ctx.object) as Ast.ENDIdentifier;
                }
                break;
            }
        }

        if (!root) {
            throw scanner.error(`Unexpected "${aNode.object.type}" in object expression`, aNode.object.start);
        }

        return new Ast.ENDGetter(root, path);
    },
    ConditionalExpression(aNode, scope, scanner, next) {
        return new Ast.ConditionalExpression(
            next(aNode.test) as Ast.Expression,
            next(aNode.consequent) as Ast.Expression,
            next(aNode.alternate) as Ast.Expression
        );
    },
    RegExpLiteral(aNode) {
        return new Ast.RegExpLiteral(aNode.regex.pattern as string, aNode.regex.flags as string);
    },
    SequenceExpression(aNode, scope, scanner, next) {
        return new Ast.SequenceExpression(
            aNode.expressions.map(next) as Ast.Expression[]
        );
    },
    UnaryExpression(aNode, scope, scanner, next) {
        return new Ast.UnaryExpression(
            aNode.operator as string,
            next(aNode.argument) as Ast.Expression
        );
    },
    UpdateExpression(aNode, scope, scanner, next) {
        return new Ast.UpdateExpression(
            aNode.operator as string,
            next(aNode.argument) as Ast.Expression,
            aNode.prefix as boolean
        );
    },
    ExpressionStatement(aNode, scope, scanner, next) {
        return new Ast.ExpressionStatement(next(aNode.expression) as Ast.Expression);
    },
    EmptyStatement() {
        return new Ast.EmptyStatement();
    },
    BlockStatement(aNode, scope, scanner, next) {
        return new Ast.BlockStatement(
            aNode.body.map(next) as Ast.Statement[]
        );
    },
    ThisExpression() {
        return new Ast.ThisExpression();
    }
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
        let value: boolean;
        if (m[2] === 'true') {
            value = true
        } else if (m[2] === 'false') {
            value = false;
        } else if (m[2] === 'null') {
            value = null;
        }

        const start = offset;
        const end = offset + m[2].length;
        const literal = scanner.astNode(new Ast.Literal(value, m[2]), start, end);
        return scanner.astNode(new Ast.Program([literal]), start, end);
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
    const scope = new Scope();

    const convert = (aNode: any): Node => {
        if (aNode == null) {
            return aNode;
        }

        if (aNode.type in converters) {
            const node = converters[aNode.type](aNode, scope, scanner, convert);
            return loc(node, aNode, scanner);
        }

        throw new UnsupportedError(aNode.type, aNode.start + scanner.start, aNode.end + scanner.start);
    }

    return convert(ast) as Ast.Program;
}

/**
 * Adds correct source location in original text stream for given JS AST node
 */
function loc<T extends Node>(node: T, aNode: AcornNode, scanner: Scanner): T {
    node.loc = {
        start: scanner.sourceLocation(aNode.start + scanner.start),
        end: scanner.sourceLocation(aNode.end + scanner.start),
        source: scanner.url
    };
    return node;
}

/**
 * Reserves identifier from given function argument
 */
function walkParam(param: any, scope: Scope): void {
    if (param.type === 'Identifier') {
        scope.reserve(param.name)
    } else if (param.type === 'ObjectExpression' || param.type === 'ObjectPattern') {
        // Object destructuring: `{a, b}` or `{a: b}`
        param.properties.forEach(prop => walkParam(prop.value, scope));
    } else if (param.type === 'ArrayExpression' || param.type === 'ArrayPattern') {
        // Array destructuring: `[a, b]`
        param.elements.forEach(elem => walkParam(elem, scope));
    }
}
