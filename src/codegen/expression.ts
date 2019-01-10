import { SourceNode } from 'source-map';
import * as Ast from '../ast/expression';
import CompileScope, { RuntimeSymbols as Symbols } from './scope';
import { ENDSyntaxError } from '../parser/syntax-error';
import { commaChunks, Chunk, ChunkList, qStr } from './utils';

/**
 * SourceNode factory which attaches location info to source map node from given
 * AST node
 */
interface SourceNodeFactory {
    (node: Ast.JSNode, chunks?: ChunkList | Chunk, name?: string): SourceNode
}

/**
 * Code generator continuation function
 */
interface Generator {
    (node: Ast.JSNode, scope: CompileScope): SourceNode
}

/**
 * Code generator for AST node of specific type
 */
interface NodeGenerator<T extends Ast.JSNode> {
    (node: T, scope: CompileScope, sn: SourceNodeFactory, next: Generator): SourceNode;
}

interface NodeGeneratorMap {
    [type: string]: NodeGenerator<Ast.JSNode>
}

const generators: NodeGeneratorMap = {
    // Basic JS nodes
    Identifier(node: Ast.Identifier, scope, sn) {
        return sn(node, node.name);
    },
    Literal(node: Ast.Literal, scope, sn) {
        return sn(node, typeof node.value === 'string'
            ? qStr(node.value) : String(node.value));
    },
    ConditionalExpression(node: Ast.ConditionalExpression, scope, sn, next) {
        // TODO check if parentheses are required here
        return sn(node, ['(', next(node.test, scope), ' ? ', next(node.consequent, scope), ' : ', next(node.alternate, scope), ')']);
    },
    ArrayExpression(node: Ast.ArrayExpression, scope, sn, next) {
        return sn(node, commaChunks(node.elements, '[', ']',
            (item, chunks) => chunks.push(next(item, scope))));
    },
    BinaryExpression(node: Ast.BinaryExpression, scope, sn, next) {
        // TODO check if parentheses are required here
        return sn(node, ['(', next(node.left, scope), ` ${node.operator} `, next(node.right, scope), ')']);
    },
    LogicalExpression(node: Ast.LogicalExpression, scope, sn, next) {
        // TODO check if parentheses are required here
        return sn(node, ['(', next(node.left, scope), ` ${node.operator} `, next(node.right, scope), ')']);
    },
    ExpressionStatement(node: Ast.ExpressionStatement, scope, sn, next) {
        return next(node.expression, scope);
    },
    ObjectExpression(node: Ast.ObjectExpression, scope, sn, next) {
        return sn(node, commaChunks(node.properties, '{', '}',
            (prop, chunks) => chunks.push(next(prop, scope))));
    },
    Property(node: Ast.Property, scope, sn, next) {
        if (node.key instanceof Ast.Identifier && node.value instanceof Ast.Identifier && node.key.name === node.value.name) {
            // Shorthand property
            return sn(node.key, next(node.key, scope));
        }

        return sn(node, [next(node.key, scope), ': ', next(node.value, scope)]);
    },
    RegExpLiteral(node: Ast.RegExpLiteral, scope, sn) {
        return sn(node, `${node.regex.pattern}/${node.regex.flags}`);
    },
    SequenceExpression(node: Ast.SequenceExpression, scope, sn, next) {
        return sn(node, commaChunks(node.expressions, '', '',
            (item, chunks) => chunks.push(next(item, scope))));
    },
    UnaryExpression(node: Ast.UnaryExpression, scope, sn, next) {
        return sn(node, [node.operator, node.operator.length > 2 ? ' ' : '', next(node.argument, scope)]);
    },
    ArrowFunctionExpression(node: Ast.ArrowFunctionExpression) {
        throw new Error(`Not implemented ${node.type}`);
    },
    CallExpression(node: Ast.CallExpression) {
        throw new Error(`Not implemented ${node.type}`);
    },

    // Endorphin addons
    ENDGetter(node: Ast.ENDGetter, scope, sn, next) {
        if (!node.path.length) {
            return next(node.root, scope);
        }

        const chunks: ChunkList = [scope.use(Symbols.get), '(', next(node.root, scope)];
        node.path.forEach(node => chunks.push(', ', next(node, scope)));
        chunks.push(')');

        return sn(node, chunks);
    },
    ENDPropertyIdentifier(node: Ast.ENDPropertyIdentifier, scope, sn) {
        return sn(node, `${scope.host}.props${propAccessor(node.name)}`, node.raw);
    },
    ENDStateIdentifier(node: Ast.ENDStateIdentifier, scope, sn) {
        return sn(node, `${scope.host}.state${propAccessor(node.name)}`, node.raw);
    },
    ENDVariableIdentifier(node: Ast.ENDVariableIdentifier, scope, sn) {
        return sn(node, `${scope.use(Symbols.getVar)}(${scope.host}, ${qStr(node.name)})`, node.raw);
    },
    ENDFilter(node: Ast.ENDFilter, scope, sn, next) {
        const params = node.filter.params.slice();

        // Add host component as first argument of function
        // TODO handle cases where `host` is already defined as function argument
        params.unshift(new Ast.Identifier(scope.host));

        // Generate function declaration for given filter
        const fnName = scope.createSymbol('filter');
        const fn = commaChunks(params, `function ${fnName}(`, ') ',
            (arg, chunks) => chunks.push(next(arg, scope)));

        fn.push('{\n\treturn ', next(node.filter.body, scope), `;\n}`);

        // Add generated function to output
        scope.push(sn(node.filter, fn));

        // Return expression that uses generated filter
        return sn(node, [scope.use(Symbols.filter), '(',
            scope.host, ', ',
            next(node.object, scope), ', ',
            fnName,
        ')']);
    }
};

export default function compileExpression(program: Ast.Program, scope: CompileScope): SourceNode {
    const expressions: Ast.Statement[] = program.body.filter(expr => expr.type !== 'EmptyStatement');

    if (expressions.length > 1) {
        throw new ENDSyntaxError(`The "${program.raw}" expression must contain single statement, ${program.raw.length} given`,
            program.loc.source, program.loc.start);
    }

    return expressions.length ? getExpression(expressions[0], scope) : sn(program, 'null');
}

/**
 * Returns expression getter
 */
const getExpression: Generator = (node, scope) => {
    if (node.type in generators) {
        return generators[node.type](node, scope, sn, getExpression);
    }

    throw new ENDSyntaxError(`${node.type} is not supported in getter expressions`,
        node.loc && node.loc.source, node.loc && node.loc.start);
};

const sn: SourceNodeFactory = (node, chunks, name) => {
    if (node.loc) {
        return new SourceNode(node.loc.start.line, node.loc.start.column, node.loc.source, chunks, name);
    }

    const output = new SourceNode();
    output.add(chunks);
    return output;
}

/**
 * Generates property accessor code
 */
function propAccessor(name: string): string {
    return /^[a-zA-Z_$][\w_$]*$/.test(name)
        ? `.${name}` : `[${qStr(name)}]`;
}
