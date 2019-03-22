import {
    ENDElement, ENDText, ENDStatement, ENDIfStatement, ENDChooseStatement,
    ENDForEachStatement, ENDAttributeStatement, ENDAddClassStatement, ENDAttributeValueExpression, ENDTemplate, ENDPartialStatement, ENDAttribute
} from '../ast/template';
import { Identifier, Program, Literal } from '../ast/expression';

const dynamicContent: Set<string> = new Set([
    'ENDIfStatement', 'ENDChooseStatement', 'ENDForEachStatement'
]);

export interface ElementStats {
    /** Whether element is a component */
    component: boolean;

    /**
     * Whether element’s content is static, e.g. no elements added or removed
     * during updates
     */
    staticContent: boolean;

    /**
     * Name of target slot where element should be outputted
     */
    slotContent?: string;

    /**
     * Whether element contains partials
     */
    hasPartials: boolean;

    /** Static text content, if any */
    text?: ENDText;

    /**
     * List of element’s attribute names whose values are expressions,
     * e.g. `attr={foo}` or `attr="foo {bar}"`
     */
    dynamicAttributes: Set<string>;

    /**
     * List of element’s events which can be updated in runtime
     */
    dynamicEvents: Set<string>;

    /** Whether element contains attribute expressions, e.g. `{foo}="bar"` */
    attributeExpressions: boolean;

    hasAnimationOut: boolean;

    /** List of namespaces used by given element */
    namespaces: {
        [prefix: string]: string
    }
}

/**
 * Collects element stats required to build optimal output
 */
export default function collectStats(elem: ENDElement): ElementStats {
    // TODO check for inner html
    const stats = createStats(elem);

    topLevelAttributeStats(elem.attributes, stats);

    // Fast path: check if element contains text node only
    const child = elem.body[0];
    if (elem.body.length === 1 && child instanceof ENDText && typeof child.value === 'string') {
        stats.text = child;
    } else {
        collectDynamicStats(elem, stats);
    }

    return stats;
}

/**
 * Collects stats about dynamic content in given element
 */
export function collectDynamicStats(elem: ENDElement | ENDTemplate, stats: ElementStats = createStats(elem)): ElementStats {
    walk(elem, node => {
        if (dynamicContent.has(node.type)) {
            stats.staticContent = false;
            collectStatsInBlock(node, stats);
        } else if (node instanceof ENDPartialStatement) {
            stats.staticContent = false;
            stats.hasPartials = true;
        } else if (node instanceof ENDAddClassStatement) {
            stats.dynamicAttributes.add('class');
        } else if (node instanceof ENDAttributeStatement) {
            // Attribute statements in top-level element context are basically
            // the same as immediate attributes of element
            topLevelAttributeStats(node.attributes, stats);
        }
        return false;
    });

    return stats;
}

function collectStatsInBlock(node: ENDStatement, stats: ElementStats) {
    walk(node, child => {
        if (dynamicContent.has(child.type)) {
            // get deeper into dynamic blocks
            return true;
        }

        if (child instanceof ENDPartialStatement) {
            stats.staticContent = false;
            stats.hasPartials = true;
        } else if (child instanceof ENDAddClassStatement) {
            stats.dynamicAttributes.add('class');
        } else if (child instanceof ENDAttributeStatement) {
            child.attributes.forEach(attr => {
                if (attr.name instanceof Identifier && !isRef(attr)) {
                    stats.dynamicAttributes.add(attr.name.name);
                } else if (attr.name instanceof Program) {
                    stats.attributeExpressions = true;
                }
            });
            child.directives.forEach(directive => {
                if (directive.prefix === 'on') {
                    stats.dynamicEvents.add(directive.name.name);
                } else if (directive.prefix === 'class') {
                    stats.dynamicAttributes.add('class');
                }
            });
        }
    });
}

/**
 * Collects element’s immediate attribute stats
 */
function topLevelAttributeStats(attributes: ENDAttribute[], stats: ElementStats): void {
    attributes.forEach(attr => {
        if (attr.name instanceof Identifier && attr.name.name === 'slot') {
            stats.slotContent = String((attr.value as Literal).value);
        }

        if (attr.name instanceof Program) {
            stats.attributeExpressions = true;
        } else if (!isRef(attr) && attr.name instanceof Identifier && (attr.value instanceof Program || attr.value instanceof ENDAttributeValueExpression)) {
            stats.dynamicAttributes.add(attr.name.name);
        }
    });
}

function isRef(attr: ENDAttribute):boolean {
    return attr.name instanceof Identifier && attr.name.name === 'ref';
}

/**
 * Creates stats object
 * @param name Name of context tag
 */
function createStats(node: ENDElement | ENDTemplate): ElementStats {
    const name = node instanceof ENDElement ? node.name.name : '';
    return {
        component: name.includes('-'),
        staticContent: true,
        dynamicAttributes: new Set(),
        dynamicEvents: new Set(),
        attributeExpressions: false,
        hasPartials: false,
        hasAnimationOut: node instanceof ENDElement ? hasAnimationOut(node) : false,
        namespaces: node instanceof ENDElement ? collectNamespaces(node) : {}
    };
}

/**
 * Collects namespaces registered in given element
 */
function collectNamespaces(elem: ENDElement): { [prefix: string]: string } {
    const result = {};
    elem.attributes.forEach(attr => {
        if (attr.name instanceof Identifier) {
            const parts = String(attr.name.name).split(':');
            const prefix = parts.shift();

            if (prefix === 'xmlns' && attr.value instanceof Literal) {
                result[parts.join(':')] = String(attr.value.value);
            }
        }
    });

    return result;
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

    if (elem instanceof ENDElement || elem instanceof ENDTemplate) {
        elem.body.forEach(visit);
    } else if (elem instanceof ENDIfStatement) {
        elem.consequent.forEach(visit);
    } else if (elem instanceof ENDChooseStatement) {
        elem.cases.forEach(branch => branch.consequent.forEach(visit));
    } else if (elem instanceof ENDForEachStatement) {
        elem.body.forEach(visit);
    }
}

function hasAnimationOut(node: ENDElement): boolean {
    return node.directives.some(attr => attr.prefix === 'animate' && attr.name.name === 'out');
}
