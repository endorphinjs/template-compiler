import { SourceNode } from "source-map";
import { ENDAttributeName, ENDAttributeValue, ENDAttributeValueExpression } from "../../ast/template";
import { Identifier, Program, Literal } from "../../ast/expression";
import CompileScope from "../scope";
import compileExpression from "../expression";
import { Chunk, qStr } from "../utils";

export function compileAttributeName(name: ENDAttributeName, scope: CompileScope): Chunk {
    if (name instanceof Identifier) {
        // Static attribute name
        return qStr(name.name);
    }

    if (name instanceof Program) {
        // Dynamic attribute name
        return compileExpression(name, scope);
    }
}

export function compileAttributeValue(value: ENDAttributeValue, scope: CompileScope, forComponent?: boolean): Chunk {
    if (value === null) {
        // Static boolean attribute
        return forComponent ? 'true' : qStr('');
    }

    if (value instanceof Literal) {
        // Static string attribute
        return qStr(String(value.value != null ? value.value : ''));
    }

    if (value instanceof Program) {
        // Dynamic expression, must be compiled to function
        return compileExpression(value, scope);
    }

    if (value instanceof ENDAttributeValueExpression) {
        // List of static and dynamic tokens, must be compiled to function
        const fnName = createConcatFunction('attrValue', scope,
            value.elements.map(elem => elem instanceof Literal ? String(elem.value) : elem))
        return `${fnName}(${scope.host}, ${scope.scope})`;
    }
}

export function createConcatFunction(prefix: string, scope: CompileScope, tokens: Array<string | Program>): string {
    const fnName = scope.enterFunction(prefix);
    const body = new SourceNode();

    body.add('return ');
    tokens.forEach((token, i) => {
        if (i !== 0) {
            body.add(' + ');
        }
        if (token instanceof Program) {
            body.add(['(', compileExpression(token, scope), ')']);
        } else {
            body.add(qStr(token));
        }
    });
    body.add(';');

    scope.push(scope.exitFunction([body]));
    return fnName;
}
