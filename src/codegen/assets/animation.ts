import { SourceNode } from 'source-map';
import { ENDDirective } from '../../ast/template';
import CompileScope, { RuntimeSymbols as Symbols } from '../scope';
import { SourceNodeFactory, cssScopeArg } from '../utils';
import { compileAttributeValue } from './attribute';
import { ENDCompileError } from '../../parser/syntax-error';

export default function generateAnimation(node: ENDDirective, scope: CompileScope, sn: SourceNodeFactory): SourceNode {
    const { name } = node.name;
    if (name === 'in') {
        return sn(node, [`${scope.use(Symbols.animateIn)}(${scope.element.localSymbol}, `, compileAttributeValue(node.value, scope), `${cssScopeArg(scope)});`]);
    }

    if (name === 'out') {
        const elemSymbol = scope.element.scopeSymbol;
        scope.func.unmount.push(sn(node, [`${elemSymbol} = ${scope.use(Symbols.animateOut)}(${elemSymbol}, `, compileAttributeValue(node.value, scope), `${cssScopeArg(scope)});`]));
        return;
    }

    throw new ENDCompileError(`Unknown directive value: "${name}"`, node);
}
