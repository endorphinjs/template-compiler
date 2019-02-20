import { SourceNode } from 'source-map';
import { ENDDirective } from '../../ast/template';
import * as JSAst from '../../ast/expression';
import { ENDCompileError } from '../../parser/syntax-error';
import CompileScope, { RuntimeSymbols as Symbols } from '../scope';
import { SourceNodeFactory, qStr, propAccessor } from '../utils';
import compileExpression, { NodeGeneratorMap } from '../expression';

/**
 * Custom generators for generating event handlers
 */
const eventGenerators: NodeGeneratorMap = {
    ENDVariableIdentifier(node: JSAst.ENDVariableIdentifier, scope, sn) {
        return sn(node, [`${scope.scope}${propAccessor(node.name)}`], node.raw);
    }
};

export default function generateEvent(node: ENDDirective, scope: CompileScope, sn: SourceNodeFactory): SourceNode {
    // Generate event handler expression. It has slightly different shape than
    // basic expressions: they must use local variable as source of runtime
    // variables
    if (!(node.value instanceof JSAst.Program)) {
        throw new ENDCompileError(`Event handler must be expression`, node.value);
    }

    const handlerName = scope.localSymbol('handler');
    const handler = (node.value.body[0] as JSAst.ExpressionStatement).expression;

    // TODO properly generate nested path like `foo.bar.baz()`
    // TODO for own element handlers, we must invoke method in context of element,
    // e.g. `elem.method()` instead of `const { method } = elem; method()`
    const eventSymbol = getEventSymbol(handler);
    const indent = scope.indent.repeat(2);

    const output = new SourceNode();
    output.add(`function ${handlerName}(event) {\n`);
    output.add([
        `${indent}const ctx = ${scope.host}.${eventSymbol} ? ${scope.host} : ${scope.host}.componentModel.definition;\n`,
        `${indent}ctx.${eventSymbol}(`
    ]);

    if (handler instanceof JSAst.CallExpression) {
        // on:click={handler(foo, bar)}
        // Add arguments to function handler but ensure that variables are fetched
        // from local variable: it is required for proper variable scoping in loops
        handler.arguments.forEach(arg => {
            output.add([compileExpression(arg, scope, eventGenerators), ', ']);
        });
    }

    output.add(`${scope.host}, event, this);`);
    output.add(`\n${scope.indent}}\n`);

    const eventType = node.name.name;
    if (scope.element.stats.dynamicEvents.has(eventType)) {
        const scopeSymbol = scope.scopeSymbol('handler');
        const ref = scope.updateSymbol('injector', scope.scopeInjector());
        scope.func.update.push(`${scope.use(Symbols.addEvent)}(${ref}, ${qStr(eventType)}, ${scopeSymbol});`);
        output.add(`${scope.indent}${scope.use(Symbols.addEvent)}(${scope.localInjector()}, ${qStr(eventType)}, ${scopeSymbol} = ${handlerName});`);
    } else {
        output.add(`${scope.indent}${scope.use(Symbols.addStaticEvent)}(${scope.element.localSymbol}, ${qStr(eventType)}, ${handlerName});`);
    }

    return output;
}

function getEventSymbol(node: JSAst.JSNode): string {
    if (node instanceof JSAst.Identifier) {
        return node.name;
    }

    if (node instanceof JSAst.CallExpression && node.callee instanceof JSAst.Identifier) {
        return node.callee.name;
    }

    throw new ENDCompileError(`Unable to get handler name from event expression`, node);
}
