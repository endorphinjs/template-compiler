import { SourceNode } from 'source-map';
import { ENDDirective } from '../../ast/template';
import * as JSAst from '../../ast/expression';
import { ENDSyntaxError } from '../../parser/syntax-error';
import CompileScope, { RuntimeSymbols as Symbols } from '../scope';
import { SourceNodeFactory, qStr } from '../utils';
import { generate, NodeGeneratorMap } from '../expression';

/**
 * Custom generators for generating event handlers
 */
const eventGenerators: NodeGeneratorMap = {
    ENDVariableIdentifier(node: JSAst.ENDVariableIdentifier, scope, sn) {
        return sn(node, [`${scope.localVars()}.${qStr(node.name)}`], node.raw);
    }
};

export default function generateEvent(node: ENDDirective, scope: CompileScope, sn: SourceNodeFactory): SourceNode {
    // Generate event handler expression. It has slightly different shape than
    // basic expressions: they must use local variable as source of runtime
    // variables
    if (!(node.value instanceof JSAst.Program)) {
        throw new ENDSyntaxError(`Event handler must be expression`, node.value.loc.source, node.value.loc.start);
    }

    const scopeVar = scope.localVars();
    const handlerName = scope.localSymbol('handler');
    const handler = node.value.body[0];
    const eventSymbol = getEventSymbol(handler);

    const output = new SourceNode();
    output.add(`${scope.indent}function ${handlerName}(event) {\n`);
    output.add([
        `${scope.indent}const ${eventSymbol} = ${scope.host}.${eventSymbol} || ${scope.host}.componentModel.definition.${eventSymbol};\n`,
        `${scope.indent}${eventSymbol}(`
    ]);

    if (handler instanceof JSAst.CallExpression) {
        // on:click={handler(foo, bar)}
        // Add arguments to function handler but ensure that variables are fetched
        // from local variable: it is required for proper variable scoping in loops
        handler.arguments.forEach(arg => {
            output.add([generate(arg, scope, eventGenerators)]);
        });
    }

    output.add(`${scope.host}, event, this)`);
    output.add(`\n}\n`);

    scope.template.update.push(`${scope.indent}${scopeVar} = ${scope.use(Symbols.getScope)}(${scope.host});\n`);

    const eventType = node.name.name;
    if (scope.element.stats.dynamicEvents.has(eventType)) {
        const bindEvent = `${scope.use(Symbols.addEvent)}(${scope.element.symbol}, ${qStr(eventType)}, ${handlerName});\n`;
        output.add([`${scope.indent}`, bindEvent]);
        scope.template.update.push(bindEvent);
    } else {
        output.add(`${scope.indent}${scope.use(Symbols.addStaticEvent)}(${scope.element.symbol}, ${qStr(eventType)}, ${handlerName});\n`);
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

    throw new ENDSyntaxError(`Unable to get handler name from event expression`, node.loc.source, node.loc.start);
}
