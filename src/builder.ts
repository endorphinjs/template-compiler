import CompileState from './compile-state';
import { ChunkList } from './utils';
import { RuntimeSymbols } from './symbols';

export type Builder = (ctx: BuilderContext) => ChunkList;
export type BuilderGetter = () => string;

export interface BuilderContext {
    /** A variable reference to host component */
    host: BuilderGetter;

    /** A variable reference to current entity */
    entity: BuilderGetter;

    /** A variable reference to parent injector */
    injector: BuilderGetter;

    /** A variable reference to current scope */
    scope: BuilderGetter;

    /** Returns reference to given store property */
    store: (name: string) => string;

    /** Current compile state */
    state: CompileState;
};

/**
 * Creates basic chunk builder that uses Endorphin runtime symbols
 */
export function symbolBuilder(symbol: RuntimeSymbols): Builder {
    return ctx => [`${ctx.state.runtime(symbol)}(${ctx.entity()});`];
}
