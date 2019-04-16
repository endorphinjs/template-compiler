import { Builder, BuilderContext } from './builder';
import CompileState from './compile-state';
import { Chunk } from './utils';

type RenderContext = 'create' | 'update' | 'destroy';

interface UsageStats {
    injector?: boolean;
    scope?: boolean;
    entity?: boolean;
}

type RenderResult = {
    [K in RenderContext]?: Chunk | null
}

/**
 * Entity is an object generated by runtime. It could be a DOM element, block,
 * iterator etc. Every object must be created and optionally updated and destroyed.
 */
export default class Entity {
    private cache?: RenderResult;
    readonly usage: { [K in RenderContext]: UsageStats }

    constructor(public name: string, public create?: Builder, public update?: Builder, public destroy?: Builder) {
        this.usage = {
            create: {},
            update: {},
            destroy: {}
        };
    }

    /** Check if entity was already rendered */
    get rendered() {
        return !!this.cache;
    }

    /**
     * Renders current entity. Render result is cached for later reuse
     */
    render(state: CompileState): RenderResult {
        const entity = this;
        let rendering: RenderContext;
        const ctx: BuilderContext = {
            state,
            host() {
                return state.options.host;
            },
            entity() {
                entity.usage[rendering].entity = true;
                return entity.name;
            },
            injector() {
                const { element } = state.blockContext;
                entity.usage[rendering].injector = true;
                return element ? element.injector : 'injector';
            },
            scope() {
                // In most cases, `scope` is passed as argument of every function
                entity.usage[rendering].scope = true;
                return state.options.scope;
            },
            store(name) {
                return state.useStore(name);
            }
        };

        const render = (name: RenderContext): Chunk | null => {
            const builder = this[rendering = name];
            return builder ? builder(ctx) : null;
        };

        this.resetUsage();
        return this.cache = {
            create: render('create'),
            update: render('update'),
            destroy: render('destroy')
        };
    }

    /**
     * Returns rendered result of current entity: might return cached result if
     * entity was already rendered
     */
    getRendered(state: CompileState): RenderResult {
        return this.cache || this.render(state);
    }

    private resetUsage() {
        this.usage.create = {};
        this.usage.update = {};
        this.usage.destroy = {};
    }
}