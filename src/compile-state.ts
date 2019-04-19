import { SourceNode } from "source-map";
import { ENDElement, ENDImport, ENDTemplate } from "@endorphinjs/template-parser";
import createGetter, { RuntimeSymbols, SymbolGetter } from "./symbols";
import BlockContext from "./block-context";
import Entity from "./entity";
import createSymbolGenerator, { SymbolGenerator } from "./symbol-generator";
import { nameToJS, propGetter, markUsed, sn, format, isIdentifier, isLiteral } from "./utils";
import ElementContext from "./element-context";
import { Chunk, RenderContext, EntityType, ChunkList, ComponentImport, CompileStateOptions, HelpersMap } from "./types";

type PlainObject = { [key: string]: string };
type NamespaceMap = { [prefix: string]: string };

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

export default class CompileState {
    /** Symbol for referencing CSS isolation scope */
    readonly cssScopeSymbol = 'cssScope';

    /** Endorphin runtime symbols required by compiled template */
    usedRuntime: Set<RuntimeSymbols> = new Set();

    /** List of helpers used in compiled template */
    private usedHelpers: Set<string> = new Set();

    /** List of symbols used for store access in template */
    usedStore: Set<string> = new Set();

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

    // TODO implement
    get hasPartials(): boolean {
        return false;
    }

    /** Symbol for referencing runtime scope */
    get scope(): string {
        markUsed(this.blockContext.scopeUsage, this.blockRenderContext);
        return this.options.scope;
    }

    /** Symbol for referencing current element’s injector */
    get injector(): string {
        const elem = this.blockContext && this.blockContext.element;
        if (elem) {
            markUsed(elem.usage, this.blockRenderContext);
            return elem.injector;
        }
    }

    /** Symbol for referencing current element */
    get element(): string {
        return this.blockContext
            && this.blockContext.element
            && this.blockContext.element.symbol;
    }

    /**
     * Creates entity symbol getter for given context
     */
    entity(type: EntityType, name?: string): Entity {
        const symbol = this.globalSymbol(nameToJS(name || type));
        const entity = new Entity(type, () => {
            markUsed(entity.usage, this.blockRenderContext);
            return symbol;
        });
        return entity;
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
    runBlock(name: string, fn: (block: BlockContext) => Entity[]): string {
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
        });

        if (updateChunks.length) {
            mountChunks.push(`return ${varName}Update;`);
        }

        if (toNull.length) {
            markUsed(block.scopeUsage, 'unmount');
            unmountChunks.push(toNull.map(entity => `${scope}.${entity.symbol} = `).join('') + 'null');
        }


        this.pushFunction(varName, `${this.host}${scopeArg(block.scopeUsage.mount)}`, mountChunks);
        this.pushFunction(`${varName}Update`, `${this.host}${scopeArg(block.scopeUsage.update)}`, updateChunks);
        this.pushFunction(`${varName}Unmount`, block.scopeUsage.unmount ? scope : '', unmountChunks);

        return varName;
    }

    /**
     * Runs given `fn` function in context of `node` element
     */
    runElement(node: ENDTemplate | ENDElement, fn: (element: ElementContext, entity: Entity) => Entity[]): Entity[] {
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
        childEntities = this.mount(() => fn(elemCtx, entity));

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
     * Generates function from given fragments and pushes it into output
     */
    pushFunction(name: string, args: string, chunks: ChunkList): void {
        if (chunks && chunks.length) {
            this.pushOutput(sn([
                `\nfunction ${name}(${args}) {\n${this.indent}`,
                ...format(chunks, this.indent),
                '\n}'
            ]));
        }
    }

    /**
     * Returns map of used helpers and their URLs
     */
    getUsedHelpers(): Map<string, string[]> {
        const result: Map<string, string[]> = new Map();

        this.usedHelpers.forEach(helper => {
            const url = this.helpers[helper];
            if (result.has(url)) {
                result.get(url).push(helper);
            } else {
                result.set(url, [helper]);
            }
        });

        return result;
    }

    /**
     * Runs given function in given rendering context
     */
    private runInContext<T>(ctx: RenderContext, fn: (state: this) => T): T {
        const prev = this.blockRenderContext;
        this.blockRenderContext = ctx;
        const result = fn(this);
        this.blockRenderContext = prev;
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
