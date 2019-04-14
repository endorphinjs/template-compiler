export type RuntimeSymbols = 'mountBlock' | 'updateBlock' | 'unmountBlock'
    | 'mountIterator' | 'updateIterator' | 'unmountIterator'
    | 'mountKeyIterator' | 'updateKeyIterator' | 'unmountKeyIterator'
    | 'mountComponent' | 'updateComponent' | 'unmountComponent'
    | 'mountInnerHTML' | 'updateInnerHTML' | 'unmountInnerHTML'
    | 'mountPartial' | 'updatePartial' | 'unmountPartial'
    | 'mountSlot' | 'unmountSlot' | 'markSlotUpdate'
    | 'createInjector' | 'block' | 'setAttribute' | 'setAttributeNS' | 'addClass'
    | 'finalizeAttributes' | 'addEvent' | 'addStaticEvent' | 'finalizeEvents'
    | 'setRef' | 'finalizeRefs' | 'createComponent' | 'updateText' | 'addDisposeCallback'
    | 'insert' | 'get' | 'call' | 'assign' | 'elem' | 'elemWithText' | 'elemNS'
    | 'elemNSWithText' | 'text' | 'filter' | 'subscribeStore'
    | 'animateIn' | 'animateOut';

export type SymbolGetter = <T extends RuntimeSymbols>(symbol: T) => T;

/**
 * A symbol getter adds all symbols into `used` set
 */
export default function createGetter(used: Set<RuntimeSymbols>): SymbolGetter {
    return symbol => {
        used.add(symbol);
        return symbol;
    };
}
