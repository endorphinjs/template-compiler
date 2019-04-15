import { SourceNode } from "source-map";
import createGetter, { RuntimeSymbols, SymbolGetter } from "./symbols";
import BlockContext from "./block-context";
import Entity from "./entity";
import createSymbolGenerator, { SymbolGenerator } from "./symbol-generator";
import { tagToJS, Chunk } from "./utils";

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
    prefix: '$$',
    suffix: '',
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
    private usedRuntime: Set<RuntimeSymbols> = new Set();

    /** List of helpers used in compiled template */
    private usedHelpers: Set<string> = new Set();

    /** List of symbols used for store access in template */
    private usedStore: Set<string> = new Set();

    /** Context of currently rendered block */
    private blockCtx?: BlockContext;

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
        this.globalSymbol = createSymbolGenerator(this.options.prefix, num => suffix + num);
    }

    /** Current indentation token */
    get indent(): string {
        return this.options.indent;
    }

    /**
     * Adds new entity to current context
     * @param entity
     */
    pushEntity(entity: Entity): void {
        this.blockCtx.push(entity);
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
        block.parent = this.blockCtx;
        this.blockCtx = block;
        this.pushOutput(fn(block));
        this.blockCtx = block.parent;

        return varName;
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
