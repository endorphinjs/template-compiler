import { SourceNode } from 'source-map';
import { ChunkList } from './utils';
import { ElementStats } from './node-stats';

/**
 * Template compiler scope
 */

export enum RuntimeSymbols {
    get, mountBlock, updateBlock, mountIterator, updateIterator, mountKeyIterator,
    updateKeyIterator, createInjector, block, enterScope, exitScope, getScope,
    getProp, getState, getVar, setVar, setAttribute, updateAttribute, updateProps,
    addClass, finalizeAttributes, finalizeProps, addEvent, addStaticEvent, finalizeEvents,
    getEventHandler, callEventHandler, renderSlot, setRef, setStaticRef, finalizeRefs, createComponent,
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

    /** Prefix for generated top-level module symbols */
    prefix?: string;

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
    parent?: TemplateContext;

    /** Output source node for runtime code, required to properly setup element context */
    output: SourceNode;

    /** Injector symbol for parent context */
    injector?: string;

    /** Context of element output */
    element?: ElementContext;

    /** Name of variable that points to local variables scope  */
    scope?: string;
}

export const defaultOptions: CompileScopeOptions = {
    host: 'host',
    indent: '\t',
    prefix: '$$',
    suffix: '',
    module: '@endorphinjs/endorphin',
    component: ''
}

export default class CompileScope {
    /** Runtime symbols required by compiled template */
    symbols: Set<RuntimeSymbols> = new Set();

    /** Context of currently rendered template */
    template?: TemplateContext;

    readonly options: CompileScopeOptions;

    /** Contents of compiled template */
    readonly body: SourceNode[] = [];

    private prefixes: {[prefix: string]: number} = {};

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

    /** Current indentation token */
    get indent(): string {
        return this.options.indent;
    }

    get element(): ElementContext {
        return this.template.element;
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
    createSymbol(name: string): string {
        const { prefixes } = this;
        const { prefix, suffix } = this.options;

        if (name in prefixes) {
            prefixes[name]++;
        } else {
            prefixes[name] = 0;
        }

        if (this.options.component != null) {
            name += this.options.component;
        }

        return prefix + name + prefixes[name] + suffix;
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

        return name + prefixes[name];
    }

    /**
     * Push given source node as content of compiled file
     */
    push(node: SourceNode): void {
        this.body.push(node);
    }

    /**
     * Enters into context of new template fragment
     * @param injectorSymbol Symbol for injector that should receive top-level
     * template content
     */
    enterTemplate(injectorSymbol?: string): SourceNode {
        const ctx: TemplateContext = {
            update: [],
            prefixes: {},
            injector: injectorSymbol,
            parent: this.template,
            output: new SourceNode()
        };
        this.template = ctx;
        return ctx.output;
    }

    exitTemplate(name: string = ''): ChunkList {
        // Generate update function for current content
        const output = new SourceNode();
        const { template, indent } = this;

        if (template.update.length) {
            // Generate update function for rendered template
            const innerIndent = indent + indent;
            output.add([`return function ${name}() {\n`]);
            template.update.forEach(node => output.add([innerIndent, node, '\n']));
            output.add(`${indent}};`);
        }

        this.template = this.template.parent;
        return [output];
    }

    enterElement(symbol: string, stats: ElementStats): SourceNode {
        const ctx: ElementContext = {
            stats,
            symbol,
            output: new SourceNode(),
            parent: this.template.element
        };

        this.template.element = ctx;
        return ctx.output;
    }

    exitElement(): ChunkList {
        // Finalize element
        const chunks: ChunkList = [];
        const { element } = this.template;

        // TODO finalize all data types
        if (element.stats.attributeExpressions || element.stats.dynamicAttributes.size) {
            chunks.push(`${this.use(RuntimeSymbols.finalizeAttributes)}(${element.symbol});`);
        }

        this.template.element = element.parent;
        return chunks;
    }

    /**
     * Returns variable name that refers to local variable scope
     */
    localVars(): string {
        const { template } = this;
        if (!template.scope) {
            // Should introduce local variable scope
            template.scope = this.localSymbol('scope');
            template.output.add(`let ${template.scope} = ${this.use(RuntimeSymbols.getScope)}(${this.host});`);
            template.update.push(`${template.scope} = ${this.use(RuntimeSymbols.getScope)}(${this.host});`);
        }

        return template.scope;
    }

    /**
     * Check if content must be inserted via injector at current context
     */
    requiresInjector(): boolean {
        const { element } = this;
        return element ? !element.stats.staticContent : !!this.template.injector;
    }

    /**
     * Returns injector instance symbol for context element
     */
    injector(): string {
        const { element } = this;
        if (element) {
            if (!element.injector) {
                const symbol = element.injector = this.localSymbol('injector');
                element.output.add(`const ${symbol} = ${this.use(RuntimeSymbols.createInjector)}(${element.symbol});`);
            }

            return element.injector;
        }

        return this.template.injector;
    }
}
