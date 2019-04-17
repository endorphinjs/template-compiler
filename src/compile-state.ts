import { SourceNode } from "source-map";
import { ENDElement, ENDImport, LiteralValue } from "@endorphinjs/template-parser";
import createGetter, { RuntimeSymbols, SymbolGetter } from "./symbols";
import BlockContext from "./block-context";
import Entity from "./entity";
import createSymbolGenerator, { SymbolGenerator } from "./symbol-generator";
import { tagToJS, Chunk, propGetter, getAttrValue } from "./utils";
import ElementContext from "./element-context";

type HelpersMap = { [url: string]: string[] };
type PlainObject = { [key: string]: string };

export interface CompileStateOptions {
    /** Path to JS module that holds Endorphin runtime functions */
    module?: string;

    /** Symbol for referencing host component of the rendered template */
    host?: string;

    /** Symbol for referencing local scope of rendered component */
    scope?: string;

    /** Symbol for referencing partials container of rendered component */
    partials?: string;

    /** String token for scoping CSS styles of component */
    cssScope?: string;

    /**
     * List of supported helpers. Key is an URL of module and value is a list of
     * available (exported) functions in this module
     */
    helpers?: HelpersMap;

    /** Name of component being compiled, must be in CamelCase */
    component?: string;

    /** Characters for one level of indentation */
    indent?: string;

    /** Prefix for generated top-level module symbols */
    prefix?: string;

    /** Suffix for generated top-level module symbols */
    suffix?: string;

    /** Do not import components which were detected as unused */
    removeUnusedImports?: boolean;

    /** Called with warning messages */
    warn?(msg: string, pos?: number): void;
}

export const defaultOptions: CompileStateOptions = {
    host: 'host',
    scope: 'scope',
    partials: 'partials',
    indent: '\t',
    prefix: '',
    suffix: '$$',
    module: '@endorphinjs/endorphin',
    component: '',
    helpers: {
        'endorphin/helpers.js': ['emit', 'setState', 'setStore']
    }
}

interface ComponentImport {
    /** JS symbol for referencing imported module */
    symbol: string;

    /** URL of module */
    href: string;

    /** Source node */
    node: ENDImport;

    /** Indicates given component was used */
    used?: boolean;
}

export default class CompileState {
    /** Symbol for referencing CSS isolation scope */
    readonly cssScopeSymbol = 'cssScope';

    /** Endorphin runtime symbols required by compiled template */
    private usedRuntime: Set<RuntimeSymbols> = new Set();

    /** List of helpers used in compiled template */
    private usedHelpers: Set<string> = new Set();

    /** List of symbols used for store access in template */
    private usedStore: Set<string> = new Set();

    /** Context of currently rendered block */
    blockContext?: BlockContext;

    readonly options: CompileStateOptions;

    /**
     * Getter for Endorphin runtime symbols: marks given symbol as used to
     * explicitly import it from Endorphin runtime lib
     */
    readonly runtime: SymbolGetter;

    /** Generated code output */
    readonly output = new SourceNode();

    /** Generates unique global JS module symbol with given name */
    globalSymbol: SymbolGenerator;

    /** Generates unique symbol with given name for storing in component scope */
    scopeSymbol: SymbolGenerator;

    /** List of child components */
    readonly componentsMap: Map<string, ComponentImport> = new Map();

    /** List of used namespaces */
    readonly namespacesMap: Map<string, string> = new Map();
    private namespaceStack: string[] = [];

    /**
     * List of available helpers. Key is a helper name (name of function) and value
     * is a module URL
     */
    readonly helpers: {
        [name: string]: string;
    }

    readonly _warned: Set<string> = new Set();

    constructor(options?: CompileStateOptions) {
        this.options = Object.assign({}, defaultOptions, options);

        this.helpers = prepareHelpers({
            ...(defaultOptions.helpers || {}),
            ...(options && options.helpers || {})
        });
        this.runtime = createGetter(this.usedRuntime);

        const suffix = tagToJS(this.options.component || '', true) + (this.options.suffix || '');
        this.globalSymbol = createSymbolGenerator(this.options.prefix, num => suffix + num.toString(36));
        this.scopeSymbol = createSymbolGenerator(this.options.prefix, num => this.options.suffix + num.toString(36));
    }

    /** Current indentation token */
    get indent(): string {
        return this.options.indent;
    }

    /** Current `xmlns` namespace symbol, if available */
    get namespace(): string | null {
        return this.namespaceStack.length ? this.namespaceStack[this.namespaceStack.length - 1] : null;
    }

    /**
     * Adds new entity to current context
     * @param entity
     */
    pushEntity(entity: Entity): void {
        this.blockContext.push(entity);
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
     * Creates new block with `name` and runs `fn` function in its context.
     * Block context, accumulated during `fn` run, will be generates and JS code
     * and added into final output
     * @returns Variables name for given block, generated from `name` argument
     */
    block(name: string, fn: (block: BlockContext) => Chunk | void): string {
        const varName = this.globalSymbol(name);
        const block = new BlockContext(varName);

        // Accumulate entities for current block
        block.parent = this.blockContext;
        this.blockContext = block;
        fn(block);
        this.blockContext = block.parent;

        // Render accumulated entities



        return varName;
    }

    /**
     * Runs given `fn` function in context of `node` element
     */
    element(node: ENDElement, fn: (element: ElementContext, block: BlockContext) => void) {
        const { blockContext: blockCtx } = this;
        if (!blockCtx) {
            throw new Error('Unable to run in element context: parent block is absent');
        }

        const prevElem = blockCtx.element;
        const elemCtx = blockCtx.element = new ElementContext(node, this.scopeSymbol);
        elemCtx.parent = prevElem;

        const xmlns = getAttrValue(node, 'xmlns');
        this.enterNamespace(xmlns);
        fn(elemCtx, blockCtx);
        this.exitNamespace(xmlns);
        blockCtx.element = prevElem;

        // Render element’s own entities to collect usage stats
        const ownEntities = elemCtx.entities.filter(entity => !entity.rendered);
        ownEntities.forEach(entity => entity.render(this));

        const parent = prevElem || blockCtx;



    }

    /**
     * Marks given helper symbol as used
     */
    useHelper(symbol: string): string {
        this.usedHelpers.add(symbol);
        return symbol;
    }

    /**
     * Marks given store property of current component as used
     * @param name
     */
    useStore(name: string): string {
        this.usedStore.add(name);
        return `${this.options.host}.store.data${propGetter(name)}`;
    }

    /** Displays warning with given message  */
    warn(msg: string, pos?: number): void {
        if (this.options.warn) {
            this.options.warn(msg, pos);
        }
    }

    /**
     * Displays warning only once for given label
     * @param label
     * @param msg
     * @param pos
     */
    warnOnce(label: string, msg: string, pos?: number): void {
        if (!this._warned.has(label)) {
            this._warned.add(label);
            this.warn(msg, pos);
        }
    }

    /**
     * Enters XML namespace with given URI. All elements will be created with given
     * namespace
     */
    private enterNamespace(ns?: LiteralValue) {
        if (ns != null) {
            const symbol = this.getNamespaceSymbol(String(ns));
            this.namespaceStack.push(symbol);
        }
    }

    /**
     * Exit current namespace
     */
    private exitNamespace(ns?: LiteralValue) {
        if (ns != null) {
            this.namespaceStack.pop();
        }
    }

    private getNamespaceSymbol(uri: string): string {
        if (!this.namespacesMap.has(uri)) {
            const symbol = this.globalSymbol('ns');
            this.namespacesMap.set(uri, symbol);
        }

        return this.namespacesMap.get(uri);
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
