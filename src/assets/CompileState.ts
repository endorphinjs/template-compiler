import { SourceNode } from "source-map";
import { ENDElement, ENDImport, ENDTemplate } from "@endorphinjs/template-parser";
import BlockContext from "./BlockContext";
import Entity from "./Entity";
import createSymbolGenerator, { SymbolGenerator } from "./SymbolGenerator";
import { nameToJS, propGetter, isIdentifier, isLiteral } from "../utils";
import { Chunk, RenderContext, ComponentImport, CompileStateOptions, HelpersMap, RuntimeSymbols } from "../types";
import ElementEntity from "./ElementEntity";

type PlainObject = { [key: string]: string };
type NamespaceMap = { [prefix: string]: string };

export const defaultOptions: CompileStateOptions = {
    host: 'host',
    scope: 'scope',
    partials: 'partials',
    indent: '\t',
    prefix: '',
    suffix: '$',
    module: '@endorphinjs/endorphin',
    component: '',
    helpers: {
        'endorphin/helpers.js': ['emit', 'setState', 'setStore']
    }
}

export default class CompileState {
    /** Symbol for referencing CSS isolation scope */
    readonly cssScopeSymbol = 'cssScope';

    /** Endorphin runtime symbols required by compiled template */
    usedRuntime: Set<RuntimeSymbols> = new Set();

    /** List of helpers used in compiled template */
    usedHelpers: Set<string> = new Set();

    /** List of symbols used for store access in template */
    usedStore: Set<string> = new Set();

    /** Context of currently rendered block */
    blockContext?: BlockContext;
    private _renderContext?: RenderContext;

    readonly options: CompileStateOptions;

    /** Generated code output */
    readonly output = new SourceNode();

    /** Generates unique global JS module symbol with given name */
    globalSymbol: SymbolGenerator;

    /** Generates unique symbol with given name for storing in component scope */
    scopeSymbol: SymbolGenerator;

    /** List of child components */
    readonly componentsMap: Map<string, ComponentImport> = new Map();

    /** List of used namespaces and their JS symbols */
    namespaceSymbols: Map<string, string> = new Map();

    /** Current namespaces */
    private namespaceMap: NamespaceMap = {};

    /**
     * List of available helpers. Key is a helper name (name of function) and value
     * is a module URL
     */
    readonly helpers: {
        [name: string]: string;
    }

    private _warned: Set<string> = new Set();

    constructor(options?: CompileStateOptions) {
        this.options = Object.assign({}, defaultOptions, options);

        this.helpers = prepareHelpers({
            ...(defaultOptions.helpers || {}),
            ...(options && options.helpers || {})
        });

        const { prefix = '', suffix = '' } = this.options;
        const globalSuffix = nameToJS(this.options.component || '', true) + suffix;
        this.globalSymbol = createSymbolGenerator(prefix, num => globalSuffix + num.toString(36));
        this.scopeSymbol = createSymbolGenerator(prefix, num => suffix + num.toString(36));
    }

    /** Current indentation token */
    get indent(): string {
        return this.options.indent;
    }

    /** Symbol for referencing host component */
    get host(): string {
        return this.options.host;
    }

    /** Symbol for referencing runtime scope */
    get scope(): string {
        const { blockContext } = this;
        return blockContext ? blockContext.scope : this.options.scope;
    }

    /** Symbol for referencing current element’s injector */
    get injector() {
        return this.element.injector;
    }

    /** Context element */
    get element(): ElementEntity {
        return this.blockContext
            && this.blockContext.element;
    }

    // TODO implement
    get hasPartials(): boolean {
        return false;
    }

    /** Symbol for referencing partials */
    get partials(): string {
        return this.options.partials;
    }

    /** Current rendering context */
    get renderContext(): RenderContext {
        return this._renderContext;
    }

    /**
     * Getter for Endorphin runtime symbols: marks given symbol as used to
     * explicitly import it from Endorphin runtime lib
     */
    runtime(symbol: RuntimeSymbols): RuntimeSymbols {
        this.usedRuntime.add(symbol);
        return symbol;
    }

    /**
     * Returns current namespace JS symbol for given prefix, if available
     */
    namespace(prefix: string = ''): string {
        const uri = this.namespaceMap[prefix];
        if (uri) {
            if (!this.namespaceSymbols.has(uri)) {
                this.namespaceSymbols.set(uri, this.globalSymbol('ns'));
            }

            return this.namespaceSymbols.get(uri);
        }
    }

    /**
     * Creates new block with `name` and runs `fn` function in its context.
     * Block context, accumulated during `fn` run, will be generates and JS code
     * and added into final output
     * @returns Variable name for given block, generated from `name` argument
     */
    runBlock(name: string, fn: (block: BlockContext) => Entity | Entity[]): string {
        const block = new BlockContext(this.globalSymbol(name), this);
        const prevBlock = this.blockContext;

        this.blockContext = block;
        const result = this.mount(() => fn(block));
        const entities = Array.isArray(result)
            ? result.filter(Boolean)
            : (result ? [result] : []);
        this.blockContext = prevBlock;

        block.generate(entities)
            .forEach(chunk => this.pushOutput(chunk));

        return block.name;
    }

    /**
     * Runs given `fn` function in context of `node` element
     */
    runElement(node: ENDTemplate | ENDElement | null, fn: (entity: ElementEntity) => void): ElementEntity {
        const { blockContext } = this;

        if (!blockContext) {
            throw new Error('Unable to run in element context: parent block is absent');
        }

        const prevElem = blockContext.element;
        const prevNsMap = this.namespaceMap;
        const entity = blockContext.element = new ElementEntity(node, this);

        if (node && node.type === 'ENDElement') {
            this.namespaceMap = {
                ...prevNsMap,
                ...collectNamespaces(node)
            };
        }

        fn(entity);

        this.namespaceMap = prevNsMap;
        blockContext.element = prevElem;
        return entity;
    }

    /**
     * Runs given function in context of child block. A child block is a block
     * which updates contents of element in outer block. It always works via
     * injector, which must be passed as function argument
     */
    runChildBlock(name: string, fn: (block: BlockContext, element: ElementEntity) => void): string {
        return this.runBlock(name, block => {
            block.useInjector = true;
            return this.runElement(null, element => fn(block, element));
        });
    }

    /**
     * Marks given helper symbol as used
     */
    helper(symbol: string): string {
        this.usedHelpers.add(symbol);
        return symbol;
    }

    /**
     * Marks given store property of current component as used
     * @param name
     */
    store(name: string): string {
        this.usedStore.add(name);
        return `${this.options.host}.store.data${propGetter(name)}`;
    }

    /**
     * Runs given function in `mount` block context
     */
    mount<T>(fn: (state: this) => T): T {
        return this.runInContext('mount', fn);
    }

    /**
     * Runs given function in `update` block context
     */
    update<T>(fn: (state: this) => T): T {
        return this.runInContext('update', fn);
    }

    /**
     * Runs given function in `unmount` block context
     */
    unmount<T>(fn: (state: this) => T): T {
        return this.runInContext('unmount', fn);
    }

    /**
     * Runs given function in `shared` block context (both `mount` and `update`)
     */
    shared<T>(fn: (state: this) => T): T {
        return this.runInContext('shared', fn);
    }

    /**
     * Check if given element is a *registered* component
     */
    isComponent(elem: ENDElement): boolean {
        const elemName = elem.name.name;
        if (this.componentsMap.has(elem.name.name)) {
            return true;
        }

        if (elem.component) {
            this.warnOnce(elemName, `Missing component definition for <${elemName}>, did you forgot to <link rel="import"> it?`, elem.loc.start.offset);
        }
    }

    /**
     * Returns component definition symbol for given element
     */
    getComponent(elem: ENDElement): string {
        const elemName = elem.name.name;
        return this.componentsMap.get(elemName).symbol;
    }

    registerComponent(elem: ENDImport) {
        this.componentsMap.set(elem.name, {
            symbol: nameToJS(elem.name, true),
            href: elem.href,
            node: elem
        });
    }

    /**
     * Displays warning with given message
     */
    warn(msg: string, pos?: number): void {
        if (this.options.warn) {
            this.options.warn(msg, pos);
        }
    }

    /**
     * Displays warning only once for given label
     */
    warnOnce(label: string, msg: string, pos?: number): void {
        if (!this._warned.has(label)) {
            this._warned.add(label);
            this.warn(msg, pos);
        }
    }

    /**
     * Adds given chunk to generated output
     */
    pushOutput(chunk: Chunk | void): void {
        if (chunk) {
            this.output.add(chunk);
            this.output.add('\n');
        }
    }

    /**
     * Runs given function in given rendering context
     */
    private runInContext<T>(ctx: RenderContext, fn: (state: this) => T): T {
        const prev = this.renderContext;
        this._renderContext = ctx;
        const result = fn(this);
        this._renderContext = prev;
        return result;
    }
}

/**
 * Generates helpers lookup map
 */
function prepareHelpers(...helpers: HelpersMap[]): PlainObject {
    const result: PlainObject = {};
    helpers.forEach(helper => {
        Object.keys(helper).forEach(key => {
            helper[key].forEach(value => result[value] = key);
        });
    });

    return result;
}

/**
 * Collects namespaces registered in given element
 */
function collectNamespaces(elem: ENDElement): NamespaceMap {
    const result = {};
    elem.attributes.forEach(attr => {
        if (isIdentifier(attr.name)) {
            const parts = attr.name.name.split(':');
            const prefix = parts.shift();

            if (prefix === 'xmlns' && isLiteral(attr.value)) {
                result[parts.join(':')] = String(attr.value.value);
            }
        }
    });

    return result;
}
