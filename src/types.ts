import { SourceNode } from 'source-map';
import { ENDImport, Node } from '@endorphinjs/template-parser';
import CompileState from './lib/CompileState';
import Entity from './entities/Entity';

export type UsageContext = 'mount' | 'update' | 'unmount';
export type RenderContext = UsageContext | 'shared';
export type RenderChunk = (entity: Entity) => Chunk;
export interface HelpersMap { [url: string]: string[]; }
export interface PlainObject { [key: string]: string; }

// AST Walkers
export type AstVisitorContinue<T> = (node: Node) => T;
export type AstVisitor<T> = (node: Node, state: CompileState, next: AstVisitorContinue<T>) => T;
export interface AstVisitorMap<T> { [name: string]: AstVisitor<T>; }

export type Chunk = string | SourceNode;
export type ChunkList = Chunk[];

export type ExpressionOutput = SourceNode;
export type ExpressionContinue = AstVisitorContinue<ExpressionOutput>;
export type ExpressionVisitorMap = AstVisitorMap<ExpressionOutput>;

export type TemplateOutput = Entity | void;
export type TemplateContinue = AstVisitorContinue<TemplateOutput>;
export type TemplateVisitorMap = AstVisitorMap<TemplateOutput>;

/** Endorphin runtime functions */
export type RuntimeSymbols = 'mountBlock' | 'updateBlock' | 'unmountBlock'
    | 'mountIterator' | 'updateIterator' | 'unmountIterator'
    | 'mountKeyIterator' | 'updateKeyIterator' | 'unmountKeyIterator'
    | 'mountComponent' | 'updateComponent' | 'unmountComponent'
    | 'mountInnerHTML' | 'updateInnerHTML' | 'unmountInnerHTML'
    | 'mountPartial' | 'updatePartial' | 'unmountPartial'
    | 'mountSlot' | 'unmountSlot' | 'markSlotUpdate'
    | 'createInjector' | 'unmountInjector' | 'block'
    | 'setAttribute' | 'setAttributeNS' | 'addClass' | 'finalizeAttributes'
    | 'addEvent' | 'addStaticEvent' | 'removeStaticEvent' | 'finalizeEvents'
    | 'setRef' | 'finalizeRefs' | 'createComponent' | 'updateText' | 'addDisposeCallback'
    | 'insert' | 'get' | 'call' | 'assign' | 'elem' | 'elemWithText' | 'elemNS'
    | 'elemNSWithText' | 'text' | 'filter' | 'find' | 'subscribeStore'
    | 'animateIn' | 'animateOut';

export interface ComponentImport {
    /** JS symbol for referencing imported module */
    symbol: string;

    /** URL of module */
    href: string;

    /** Source node */
    node: ENDImport;

    /** Indicates given component was used */
    used?: boolean;
}

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
