import { SourceNode } from 'source-map';
import { ElementStats } from './node-stats';
import CompileScope, { RuntimeSymbols } from './scope';
import { format, Chunk, ChunkList, tagToJS } from './utils';

export default class ElementContext {
    parent?: ElementContext;

    /** Output source node with mounted element */
    output: SourceNode;

    /** Unmount code for context element, used for animations */
    unmount: Chunk[] = [];

    /** Callback argument for animation end callback */
    unmountCallbackArg: SourceNode = new SourceNode();

    private _localSymbol: string;
    private _scopeSymbol: string;
    private _localInjector: string;
    private _scopeInjector: string;
    private _injector: string;

    constructor(readonly name: string, readonly expr: Chunk, readonly stats: ElementStats, readonly scope: CompileScope, readonly isComponent: boolean) {
        this.output = new SourceNode();
    }

    /**
     * Local symbol for referencing element in mount scope
     */
    get localSymbol(): string {
        if (!this._localSymbol) {
            this._localSymbol = this.scope.localSymbol(tagToJS(this.name));
        }

        return this._localSymbol;
    }

    /**
     * Scope symbol for referencing element in update scope
     */
    get scopeSymbol(): string {
        if (!this._scopeSymbol) {
            this._scopeSymbol = this.scope.scopeSymbol(tagToJS(this.name));
        }

        return this._scopeSymbol;
    }

    /**
     * Local symbol for referencing element in mount scope
     */
    get localInjector(): string {
        if (!this._localInjector) {
            this._localInjector = this.scope.localSymbol('injector');
        }

        return this._localInjector;
    }

    /**
     * Scope symbol for referencing element in update scope
     */
    get scopeInjector(): string {
        if (!this._scopeInjector) {
            this._scopeInjector = this.scope.scopeSymbol('injector');
        }

        return this._scopeInjector;
    }

    /**
     * Check if element has injector reference
     */
    get hasInjector(): boolean {
        return Boolean(this._localInjector || this._scopeInjector);
    }

    /**
     * Sets symbol for mounting injector
     */
    set injector(value: string) {
        this._injector = value;
    }

    /**
     * Returns symbol for mounting injector
     */
    get injector(): string {
        return this._injector || `${this.scope.use(RuntimeSymbols.createInjector)}(${this.localSymbol})`;
    }

    /**
     * Check if current context used scope injector
     */
    get hasScopeInjector(): boolean {
        return !!this._scopeInjector;
    }

    /**
     * Finalizes element and returns code required for element finalization
     */
    finalize(): SourceNode {
        const chunks: ChunkList = [];
        const result = new SourceNode();

        // First, we have generate finalization code to create local variable
        // references, if required
        if (!this.isComponent) {
            if (this.stats.attributeExpressions || this.stats.dynamicAttributes.size) {
                const ref = this.scope.updateSymbol('injector', this.scopeInjector);
                this.scope.pushUpdate(`${this.scope.use(RuntimeSymbols.finalizeAttributes)}(${ref});`);
                chunks.push(`${this.scope.use(RuntimeSymbols.finalizeAttributes)}(${this.localInjector});`);
            }

            if (this.stats.dynamicEvents.size) {
                const ref = this.scope.updateSymbol('injector', this.scopeInjector);
                this.scope.pushUpdate(`${this.scope.use(RuntimeSymbols.finalizeEvents)}(${ref});`);
                chunks.push(`${this.scope.use(RuntimeSymbols.finalizeEvents)}(${this.localInjector});`);
            }
        }

        result.add(format(chunks, this.scope.indent));

        if (this._localSymbol || this.hasInjector) {
            this.output.add(`const ${this.localSymbol} = `);
        }

        if (this._scopeSymbol) {
            this.output.add(`${this.scopeSymbol} = `);
        }

        this.output.add([this.expr, `;`]);

        if (this.hasInjector) {
            this.output.add(`\n${this.scope.indent}`);
            if (this._localInjector) {
                this.output.add(`const ${this.localInjector} = `);
            }

            if (this.hasScopeInjector) {
                this.output.add(`${this.scopeInjector} = `);
            }

            this.output.add([this.injector, ';']);
        }

        return result;
    }
}
