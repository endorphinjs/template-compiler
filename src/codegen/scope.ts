import { FunctionParameter, BlockStatement, Expression, FunctionDeclaration, Identifier } from "../ast/expression";

/**
 * A scope data used in compiled template
 */

 export enum RuntimeSymbols {
    get, mountBlock, updateBlock, mountIterator, updateIterator, mountKeyIterator,
    updateKeyIterator, createInjector, block, enterScope, exitScope, getScope,
    getProp, getState, getVar, setVar, setAttribute, updateAttribute, updateProps,
    addClass, finalizeAttributes, finalizeProps, addEvent, addStaticEvent, finalizeEvents,
    getEventHandler, renderSlot, setRef, setStaticRef, finalizeRefs, createComponent,
    mountComponent, updateComponent, unmountComponent, mountInnerHTML, updateInnerHTML,
    elem, elemWithText, text, updateText, filter
 }

export default class CompileScope {
    /** Runtime symbols required by compiled template */
    symbols: Set<RuntimeSymbols> = new Set();

    /** Symbol for referencing host component of the rendered template */
    host = 'host';

    private prefixes: {[prefix: string]: number} = {};

    /** List of functions registered by compiler  */
    functions: FunctionDeclaration[] = [];

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
    createSymbol(prefix: string): string {
        if (prefix in this.prefixes) {
            this.prefixes[prefix]++;
        } else {
            this.prefixes[prefix] = 0;
        }

        return `${prefix}${this.prefixes[prefix]}$$$end`;
    }

    /**
     * Registers a new module function with `prefix` in its name and returns
     * final function name
     */
    registerFunction(prefix: string, params: FunctionParameter[], body: BlockStatement | Expression): string {
        const name = this.createSymbol(prefix);
        const fn = new FunctionDeclaration(new Identifier(name), params, body);
        this.functions.push(fn);

        return name;
    }
}
