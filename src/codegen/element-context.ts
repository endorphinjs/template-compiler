import { SourceNode } from 'source-map';
import { ElementStats } from './node-stats';
import CompileScope, { RuntimeSymbols } from './scope';
import { format, Chunk, ChunkList } from './utils';

export default class ElementContext {
    parent?: ElementContext;

    /** Output source node with mounted element */
    output: SourceNode;

    private _localSymbol: string;
    private _scopeSymbol: string;
    private _localInjector: string;
    private _scopeInjector: string;

    constructor(readonly name: string, readonly expr: Chunk, readonly stats: ElementStats, readonly scope: CompileScope) {
        this.output = new SourceNode();
    }

    /**
     * Local symbol for referencing element in mount scope
     */
    get localSymbol(): string {
        if (!this._localSymbol) {
            this._localSymbol = this.scope.localSymbol(this.name);
        }

        return this._localSymbol;
    }

    /**
     * Scope symbol for referencing element in update scope
     */
    get scopeSymbol(): string {
        if (!this._scopeSymbol) {
            this._scopeSymbol = this.scope.scopeSymbol(this.name);
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
     * Finalizes element and returns code required for element finalization
     */
    finalize(): SourceNode {
        const chunks: ChunkList = [];
        const result = new SourceNode();

        // First, we have generate finalization code to create local variable
        // references, if required

        // TODO finalize all data types
        if (this.stats.attributeExpressions || this.stats.dynamicAttributes.size) {
            chunks.push(`${this.scope.use(RuntimeSymbols.finalizeAttributes)}(${this.scopeSymbol});`);
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
            if (this._localInjector) {
                this.output.add(`const ${this.localInjector} = `);
            }

            if (this._scopeInjector) {
                this.output.add(`${this.scopeInjector} = `);
            }

            this.output.add(`${this.scope.use(RuntimeSymbols.createInjector)}(${this.localSymbol});`);
        }

        return result;
    }
}
