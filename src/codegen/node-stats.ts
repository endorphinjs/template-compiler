import {
    ENDElement, ENDText, ENDStatement, ENDIfStatement, ENDChooseStatement,
    ENDForEachStatement, ENDAttributeStatement, ENDAddClassStatement, ENDAttributeValueExpression, ENDTemplate, ENDPartialStatement, ENDAttribute, ENDPartial
} from '../ast/template';
import { Identifier, Program } from '../ast/expression';

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
}

/**
 * Collects element stats required to build optimal output
 */
export default function collectStats(elem: ENDElement): ElementStats {
    // TODO check for inner html
    const stats = createStats(elem.name.name);

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
export function collectDynamicStats(elem: ENDElement | ENDTemplate, stats: ElementStats = createStats()): ElementStats {
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

/**
 * Check if given template contains element references
 */
export function hasRefs(template: ENDTemplate): boolean {
    let result = false;
    walk(template, node => {
        // Since partials can be overridden in runtime, we don’t know if they
        // contain any refs for sure so assume they does.
        result = node instanceof ENDPartial
            || ((node instanceof ENDElement || node instanceof ENDAttributeStatement) && node.attributes.some(isRef));

        return !result;
    });

    return result;
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
function createStats(name: string = ''): ElementStats {
    return {
        component: name.includes('-'),
        staticContent: true,
        dynamicAttributes: new Set(),
        dynamicEvents: new Set(),
        attributeExpressions: false,
        hasPartials: false
    };
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
