import { SourceNode } from 'source-map';

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
    elem, elemWithText, text, updateText, filter
 }

export default class CompileScope {
    /** Runtime symbols required by compiled template */
    symbols: Set<RuntimeSymbols> = new Set();

    /** Path to JS module that holds Endorphin runtime functions */
    module: string = '@endorphinjs/endorphin';

    /** Symbol for referencing host component of the rendered template */
    host = 'host';

    private prefixes: {[prefix: string]: number} = {};

    /**
     * Contents of compiled template
     */
    readonly body: SourceNode[] = [];

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
     * Push given source node as content of compiled file
     */
    push(node: SourceNode): void {
        this.body.push(node);
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
