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
    elem, elemWithText, text, updateText
 }

export default class CompileScope {
    /** Runtime symbols required by compiled template */
    symbols: Set<RuntimeSymbols> = new Set();

    /** Symbol for referencing host component of the rendered template */
    host = 'host';

    /**
     * Marks given runtime symbol as used by template and returns its string
     * representation
     * @param symbol
     */
    use(symbol: RuntimeSymbols): string {
        this.symbols.add(symbol);
        return RuntimeSymbols[symbol];
    }
}
