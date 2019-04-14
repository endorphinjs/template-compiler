import createGetter, { RuntimeSymbols, SymbolGetter } from "./symbols";
import BlockContext from "./block-context";
import Entity from "./entity";
import createSymbolGenerator, { SymbolGenerator } from "./symbol-generator";
import { tagToJS } from "./utils";

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
    block?: BlockContext;

    readonly options: CompileStateOptions;
    readonly runtime: SymbolGetter;

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
        const suffix = tagToJS(this.options.component || '', true) + (this.options.suffix || '');
        this.options = Object.assign({}, defaultOptions, options);

        this.helpers = prepareHelpers({
            ...(defaultOptions.helpers || {}),
            ...(options && options.helpers || {})
        });
        this.runtime = createGetter(this.usedRuntime);
        this.globalSymbol = createSymbolGenerator(this.options.prefix, num => suffix + num);
    }

    /**
     * Adds new entity to current context
     * @param entity
     */
    pushEntity(entity: Entity) {
        this.block.push(entity);
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
