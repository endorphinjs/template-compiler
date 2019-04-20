import { ENDElement, ENDTemplate, Node, ENDAttributeStatement, ENDAttribute, ENDStatement } from "@endorphinjs/template-parser";
import Entity from "./entity";
import { usageStats, isLiteral, isExpression, isIdentifier, markUsed } from "./utils";
import CompileState from "./compile-state";

const dynamicContent = new Set(['ENDIfStatement', 'ENDChooseStatement', 'ENDForEachStatement']);

/**
 * Contains data about element context
 */
export default class ElementContext {
    private _injector: string;

    /**
     * Whether element contains partials
     */
    hasPartials: boolean;

    /**
     * List of element’s attribute names whose values are expressions,
     * e.g. `attr={foo}` or `attr="foo {bar}"`
     */
    dynamicAttributes: Set<string> = new Set();

    /**
     * List of element’s events which can be updated in runtime
     */
    dynamicEvents: Set<string> = new Set();

    /** Whether element contains attribute expressions, e.g. `{foo}="bar"` */
    attributeExpressions: boolean;

    hasAnimationOut: boolean;

    /** Injector usage stats in different contexts */
    readonly usage = usageStats();

    constructor(readonly node: ENDElement | ENDTemplate, readonly entity: Entity, private state: CompileState) {
        // Collect stats about given element
        if (node.type === 'ENDElement') {
            node.attributes.forEach(attr => {
                if (isExpression(attr.name)) {
                    this.attributeExpressions = true;
                } else if (attr.value && !isLiteral(attr.value)) {
                    this.dynamicAttributes.add(attr.name.name);
                }
            });

            this.hasAnimationOut = node.directives.some(attr => attr.prefix === 'animate' && attr.name === 'out');
        }

        collectStats(node, this);
    }

    /** Symbol for referencing element */
    get symbol(): string {
        return this.entity.symbol;
    }

    /** Symbol for referencing element’s injector */
    get injector(): string {
        markUsed(this.usage, this.state.renderContext);
        return this._injector || (this._injector = this.state.scopeSymbol('inj'));
    }

    /** Indicates that element context should use injector to operate */
    get usesInjector(): boolean {
        return this._injector != null;
    }

    /** Indicates that current element is a component */
    get isComponent(): boolean {
        return isElement(this.node) && this.node.component;
    }

    /**
     * Check if given attribute name is dynamic, e.g. can be changed by nested
     * statements
     */
    isDynamicAttribute(attr: string | ENDAttribute): boolean {
        if (typeof attr === 'string') {
            return this.dynamicAttributes.has(attr);
        }

        if (isIdentifier(attr.name)) {
            return this.dynamicAttributes.has(attr.name.name);
        }

        return false;
    }
}

/**
 * Check if given AST node is element
 */
function isElement(node: Node): node is ENDElement {
    return node.type === 'ENDElement';
}

function collectStats(elem: ENDElement | ENDTemplate, state: ElementContext) {
    walk(elem, node => {
        if (node.type === 'ENDPartialStatement') {
            state.hasPartials = true;
        } else if (node.type === 'ENDAddClassStatement') {
            state.dynamicAttributes.add('class');
        } else if (node.type === 'ENDAttributeStatement') {
            // Attribute statements in top-level element context are basically
            // the same as immediate attributes of element
            attributesStats(node, state);
        }

        return dynamicContent.has(node.type);
    });
}

/**
 * Walks over contents of given element and invokes `callback` for each body item.
 * A `callback` must return `true` if walker should visit contents of context node,
 * otherwise it will continue to next node
 */
function walk(elem: ENDStatement | ENDTemplate, callback: (node: ENDStatement) => boolean): void {
    const visit = (node: ENDStatement): void => {
        if (callback(node) === true) {
            walk(node, callback);
        }
    };

    if (elem.type === 'ENDElement' || elem.type === 'ENDTemplate') {
        elem.body.forEach(visit);
    } else if (elem.type === 'ENDIfStatement') {
        elem.consequent.forEach(visit);
    } else if (elem.type === 'ENDChooseStatement') {
        elem.cases.forEach(branch => branch.consequent.forEach(visit));
    } else if (elem.type === 'ENDForEachStatement') {
        elem.body.forEach(visit);
    }
}

function attributesStats(node: ENDAttributeStatement, state: ElementContext) {
    node.attributes.forEach(attr => {
        if (isExpression(attr.name)) {
            state.attributeExpressions = true;
        } else {
            state.dynamicAttributes.add(attr.name.name);
        }
    });
    node.directives.forEach(directive => {
        if (directive.prefix === 'on') {
            state.dynamicEvents.add(directive.name);
        } else if (directive.prefix === 'class') {
            state.dynamicAttributes.add('class');
        }
    });
}
