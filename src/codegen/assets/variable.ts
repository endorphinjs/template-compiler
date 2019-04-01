import { SourceNode } from 'source-map';
import { ENDAttributeName, ENDAttributeValue, ENDAttributeValueExpression, ENDVariable, ENDVariableStatement } from "../../ast/template";
import { Identifier, Literal, Program } from '../../ast/expression';
import CompileScope from '../scope';
import { propAccessor, SourceNodeFactory, wrapSN } from '../utils';
import compileExpression from '../expression';

export default function compileVariableStatement(statement: ENDVariableStatement, scope: CompileScope, sn: SourceNodeFactory): SourceNode {
    const fnName = scope.enterFunction('vars');
    const { scopeArg } = scope.func;
    const chunks = statement.variables.map(variable => compileVariable(variable, scope, sn));

    scope.push(scope.exitFunction(chunks));

    // If shorthand function requires scope argument, mark scope as used in
    // outer function as well
    if (scopeArg.children.length) {
        scope.markScopeAsUsed();
    }

    return sn(statement, [`${fnName}(${scope.host}`, scopeArg, `);`]);
}

export function compileVariable(variable: ENDVariable, scope: CompileScope, sn: SourceNodeFactory): SourceNode {
    return wrapSN([compileName(variable.name, scope, sn), ` = `, compileValue(variable.value, scope, sn), ';']);
}

function compileName(name: ENDAttributeName, scope: CompileScope, sn: SourceNodeFactory): SourceNode {
    if (name instanceof Identifier) {
        // Static attribute name
        return sn(name, [scope.scope, propAccessor(name.name)]);
    }

    return sn(name, [scope.scope, '[', compileExpression(name, scope), ']']);
}

function compileValue(value: ENDAttributeValue, scope: CompileScope, sn: SourceNodeFactory) {
    if (value instanceof Literal) {
        return sn(value, JSON.stringify(value.value));
    }

    if (value instanceof Program) {
        return compileExpression(value, scope);
    }

    if (value instanceof ENDAttributeValueExpression) {
        const result = new SourceNode();
        value.elements.forEach((elem, i) => {
            if (i !== 0) {
                result.add(' + ');
            }

            result.add(compileValue(elem, scope, sn));
        });
        return result;
    }
}
