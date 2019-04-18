import { SourceNode } from "source-map";
import { ENDElement, ENDImport, ENDTemplate } from "@endorphinjs/template-parser";
import createGetter, { RuntimeSymbols, SymbolGetter } from "./symbols";
import BlockContext from "./block-context";
import Entity from "./entity";
import createSymbolGenerator, { SymbolGenerator } from "./symbol-generator";
import { tagToJS as nameToJS, propGetter, usageStats, markUsed, sn, format } from "./utils";
import ElementContext from "./element-context";
import { Chunk, RenderContext, EntityType, ChunkList } from "./types";

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

type NamespaceMap = { [prefix: string]: string };

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
    private blockRenderContext?: RenderContext;

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

    /** List of used namespaces and their JS symbols */
    private namespaceSymbols: Map<string, string> = new Map();

    /** Current namespaces */
    private namespaceMap: NamespaceMap = {};

    private scopeUsage = usageStats();

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

        const suffix = nameToJS(this.options.component || '', true) + (this.options.suffix || '');
        this.globalSymbol = createSymbolGenerator(this.options.prefix, num => suffix + num.toString(36));
        this.scopeSymbol = createSymbolGenerator(this.options.prefix, num => this.options.suffix + num.toString(36));
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
        markUsed(this.scopeUsage, this.blockRenderContext);
        return this.options.scope;
    }

    /** Symbol for referencing injector */
    get injector(): string {
        const elem = this.blockContext && this.blockContext.element;
        if (elem) {
            markUsed(elem.usage, this.blockRenderContext);
            return elem.injector;
        }
    }

    /**
     * Creates entity symbol getter for given context
     */
    entity(type: EntityType, name: string): Entity {
        const symbol = this.globalSymbol(nameToJS(name));
        const entity = new Entity(type, () => {
            markUsed(entity.usage, this.blockRenderContext);
            return symbol;
        });
        return entity;
    }

    /**
     * Returns current namespace JS symbol for given prefix, if available
     */
    namespace(prefix: string = ''): string | null {
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
     * @returns Variables name for given block, generated from `name` argument
     */
    block(name: string, fn: (block: BlockContext) => Entity[]): void {
        const varName = this.globalSymbol(name);
        const block = new BlockContext(varName);
        const prevBlock = this.blockContext;

        this.blockContext = block;
        const entities = fn(block).filter(Boolean);
        this.blockContext = prevBlock;

        // Generate mount, update and unmount functions from received entities

        // List of entities that must be explicitly nulled because of absent unmount code
        const toNull: Entity[] = [];

        const { scope } = this.options;
        const scopeArg = (count: number): string => count ? `, ${scope}` : '';

        let mountChunks: ChunkList = [];
        const updateChunks: ChunkList = [];
        const unmountChunks: ChunkList = [];
        let mountScopeUsage = 0;
        let updateScopeUsage = 0;
        let unmountScopeUsage = 0;

        entities.forEach(entity => {
            if (entity.mount) {
                mountChunks.push(entity.mount);
            }

            mountChunks = mountChunks.concat(entity.fill);

            if (entity.update) {
                updateChunks.push(entity.update);
                if (!entity.unmount) {
                    toNull.push(entity);
                }
            }

            if (entity.unmount) {
                unmountChunks.push(entity.unmount);
            }

            mountScopeUsage += entity.usage.mount;
            updateScopeUsage += entity.usage.update;
            unmountScopeUsage += entity.usage.unmount;
        });

        if (updateChunks.length) {
            mountChunks.push(`return ${varName}Update;`);
        }

        if (toNull.length) {
            unmountScopeUsage++;
            unmountChunks.push(toNull.map(entity => `${scope}.${entity.symbol} = `).join('') + 'null');
        }

        this.outputFunction(varName, `${this.host}${scopeArg(mountScopeUsage)}`, mountChunks);
        this.outputFunction(`${varName}Update`, `${this.host}${scopeArg(updateScopeUsage)}`, updateChunks);
        this.outputFunction(`${varName}Unmount`, unmountScopeUsage ? scope : '', unmountChunks);
    }

    /**
     * Runs given `fn` function in context of `node` element
     */
    element(node: ENDTemplate | ENDElement, fn: (element: ElementContext, entity: Entity) => Entity[]): Entity[] {
        const elemName = node.type === 'ENDTemplate' ? 'target' : node.name.name;
        const entity = this.entity('element', elemName);
        const { blockContext } = this;
        if (!blockContext) {
            throw new Error('Unable to run in element context: parent block is absent');
        }

        const prevElem = blockContext.element;
        const prevNsMap = this.namespaceMap;
        const elemCtx = blockContext.element
            = new ElementContext(node, entity, this.scopeSymbol);

        if (node.type === 'ENDElement') {
            this.namespaceMap = {
                ...prevNsMap,
                ...collectNamespaces(node)
            };
        }

        let childEntities: Entity[];
        this.runInContext('mount', () => childEntities = fn(elemCtx, entity));

        this.namespaceMap = prevNsMap;
        blockContext.element = prevElem;
        return [entity].concat(childEntities).filter(Boolean);
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
    mount(fn: (state: this) => void): void {
        this.runInContext('mount', fn);
    }

    /**
     * Runs given function in `update` block context
     */
    update(fn: (state: this) => void): void {
        this.runInContext('update', fn);
    }

    /**
     * Runs given function in `unmount` block context
     */
    unmount(fn: (state: this) => void): void {
        this.runInContext('unmount', fn);
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
    private runInContext(ctx: RenderContext, fn: (state: this) => void): void {
        const prev = this.blockRenderContext;
        this.blockRenderContext = ctx;
        fn(this);
        this.blockRenderContext = prev;
    }

    private outputFunction(name: string, args: string, chunks: ChunkList): void {
        if (chunks) {
            this.output.add(sn([
                `\nfunction ${name}(${args}) {\n${this.indent}`,
                ...format(chunks, this.indent),
                '\n}\n'
            ]));
        }
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
        if (attr.name.type === 'Identifier') {
            const parts = attr.name.name.split(':');
            const prefix = parts.shift();

            if (prefix === 'xmlns' && attr.value.type === 'Literal') {
                result[parts.join(':')] = String(attr.value.value);
            }
        }
    });

    return result;
}
