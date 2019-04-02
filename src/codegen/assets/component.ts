import { ENDElement } from '../../ast/template';
import CompileScope, { RuntimeSymbols } from '../scope';
import { Chunk, isDynamicAttribute, isRef, propSetter, wrapSN, qStr, ChunkList } from '../utils';
import { compileAttributeValue } from './attribute';

export function collectStaticProps(elem: ENDElement, scope: CompileScope): Map<Chunk, Chunk> {
    const attrs: Map<Chunk, Chunk> = new Map();

    elem.attributes.forEach(attr => {
        if (isDynamicAttribute(attr, scope) || isRef(attr)) {
            return;
        }

        attrs.set(propSetter(attr.name, scope), compileAttributeValue(attr.value, scope, true));
    });

    elem.directives.forEach(dir => {
        if (dir.prefix === 'partial') {
            const value: ChunkList = [
                `${scope.use(RuntimeSymbols.assign)}({ ${scope.host} }, `,
                `${scope.partials}[`,
                    compileAttributeValue(dir.value, scope, true),
                '])'];
            attrs.set(qStr(`${dir.prefix}:${dir.name.name}`), wrapSN(value));
        }
    });

    return attrs;
}
