import { SourceNode } from 'source-map';
import { ChunkList, Chunk } from './utils';
import { ElementStats } from './node-stats';

/**
 * Template compiler scope
 */

export enum RuntimeSymbols {
    get, mountBlock, updateBlock, mountIterator, updateIterator, mountKeyIterator,
    updateKeyIterator, createInjector, block, enterScope, exitScope, getScope,
    getProp, getState, getVar, setVar, setAttribute, updateAttribute, updateProps,
    addClass, finalizeAttributes, finalizeProps, addEvent, addStaticEvent, finalizeEvents,
    getEventHandler, renderSlot, setRef, setStaticRef, finalizeRefs, createComponent,
    mountComponent, updateComponent, unmountComponent, mountInnerHTML, updateInnerHTML,
    elem, elemWithText, text, updateText, filter, insert
}

interface CompileScopeOptions {
    /** Path to JS module that holds Endorphin runtime functions */
    module?: string;

    /** Symbol for referencing host component of the rendered template */
    host?: string;

    /** Name of component being compiled, must be in CamelCase */
    component?: string;

    /** Characters for one level of indentation */
    indent?: string;

    /** Suffix for generated top-level module symbols */
    suffix?: string;
}

interface ElementContext {
    /** Name of parent element symbol (element or injector) */
    symbol: string;

    /** Element stats */
    stats: ElementStats;

    /** Name of injector instance bound to element. */
    injector?: string;

    /** Output source node for runtime code, required to properly setup element context */
    output: SourceNode;

    parent?: ElementContext;
}

interface TemplateContext {
    update: ChunkList;
    prefixes: { [prefix: string]: number };
}

export const defaultOptions: CompileScopeOptions = {
    host: 'host',
    indent: '\t',
    suffix: '$$end',
    module: '@endorphinjs/endorphin',
    component: ''
}

export default class CompileScope {
    /** Runtime symbols required by compiled template */
    symbols: Set<RuntimeSymbols> = new Set();

    /** Context of currently rendered element */
    element?: ElementContext;

    /** Context of currently rendered template */
    template?: TemplateContext;

    readonly options: CompileScopeOptions;

    /** Contents of compiled template */
    readonly body: SourceNode[] = [];

    private prefixes: {[prefix: string]: number} = {};
    private _level: number = 0;
    private _indent: string = '';

    constructor(options?: CompileScopeOptions) {
        this.options = Object.assign({}, defaultOptions, options);
    }

    /** Symbol for referencing host component of the rendered template */
    get host(): string {
        return this.options.host;
    }

    /** Path to JS module that holds Endorphin runtime functions */
    get module(): string {
        return this.options.module;
    }

    /** Current indentation level */
    get level(): number {
        return this._level;
    }

    set level(value: number) {
        this._level = value;
        this._indent = this.options.indent.repeat(value);
    }

    /** Current indentation token */
    get indent(): string {
        return this._indent;
    }

    /**
     * Marks given runtime symbol as used by template and returns its string
     * representation
     * @param symbol
     */
    use(symbol: RuntimeSymbols): string {
        this.symbols.add(symbol);
        return RuntimeSymbols[symbol];
    }

    /**
     * Creates unique template symbol (function or variable name) with `prefix` in it
     */
    createSymbol(prefix: string, includeComponentName?: boolean): string {
        const { prefixes } = this;

        if (prefix in prefixes) {
            prefixes[prefix]++;
        } else {
            prefixes[prefix] = 0;
        }

        const name = includeComponentName && this.options.component || '';

        return `${prefix}${name}${prefixes[prefix]}${this.options.suffix}`;
    }

    /**
     * Generates symbol, local to rendered template
     */
    localSymbol(name: string): string {
        const { prefixes } = this.template;

        if (name in prefixes) {
            prefixes[name]++;
        } else {
            prefixes[name] = 0;
        }

        return `${name}${prefixes[name]}`;
    }

    /**
     * Push given source node as content of compiled file
     */
    push(node: SourceNode): void {
        this.body.push(node);
    }

    enterTemplate(): void {
        this.template = {
            update: [],
            prefixes: {}
        };
        this.level++;
    }

    exitTemplate(): void {
        this.level--;
        this.template = null;
    }

    enterElement(symbol: string, stats: ElementStats): Chunk {
        const ctx: ElementContext = {
            stats,
            symbol,
            output: new SourceNode(),
            // symbol: stats.staticContent ? symbol : this.createSymbol('injector'),
            parent: this.element
        };

        this.element = ctx;
        return ctx.output;
    }

    exitElement() {
        this.element = this.element.parent;
    }

    /**
     * Returns injector instance symbol for context element
     */
    injector(): string {
        if (!this.element.injector) {
            const symbol = this.element.injector = this.createSymbol('injector');
            this.element.output.add(`const ${symbol} = ${this.use(RuntimeSymbols.createInjector)}(${this.element.symbol});`);
        }

        return this.element.injector;
    }

    /**
     * Outputs compiled template
     */
    toString(): string {
        const output = new SourceNode();

        if (this.symbols.size) {
            output.add(`import { ${Array.from(this.symbols).map(s => RuntimeSymbols[s]).join(', ')} } from '${this.module}';\n\n`);
        }

        this.body.forEach((node, i) => {
            if (i !== 0) {
                output.add('\n\n');
            }
            output.add(node);
        });

        return output.toString();
    }
}
