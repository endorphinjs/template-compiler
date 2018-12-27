import {
    ENDElement, ENDText, ENDStatement, ENDIfStatement, ENDChooseStatement,
    ENDForEachStatement, ENDAttributeStatement, ENDAddClassStatement, ENDAttributeValueExpression
} from '../ast/template';
import { Identifier, Program } from '../ast/expression';

const dynamicContent: Set<string> = new Set([
    'ENDIfStatement', 'ENDChooseStatement', 'ENDForEachStatement',
    'ENDPartialStatement', 'Program'
]);

export interface ElementStats {
    /** Whether element is a component */
    component: boolean;

    /**
     * Whether element’s content is static, e.g. no elements added or removed
     * during updates
     */
    staticContent: boolean;

    /** Static text content, if any */
    text?: ENDText;

    /**
     * List of element’s attribute names whose values are expressions,
     * e.g. `attr={foo}` or `attr="foo {bar}"`
     */
    dynamicAttributes: Set<string>;

    /** Whether element contains attribute expressions, e.g. `{foo}="bar"` */
    attributeExpressions: boolean;
}

/**
 * Collects element stats required to build optimal output
 */
export default function collectStats(elem: ENDElement): ElementStats {
    // TODO check for inner html
    const stats: ElementStats = {
        component: elem.name.name.includes('-'),
        staticContent: true,
        dynamicAttributes: new Set(),
        attributeExpressions: false
    };

    // Check immediate attributes
    elem.attributes.forEach(attr => {
        if (attr.name instanceof Program) {
            stats.attributeExpressions = true;
        } else if (attr.name instanceof Identifier && (attr.value instanceof Program || attr.value instanceof ENDAttributeValueExpression)) {
            stats.dynamicAttributes.add(attr.name.name);
        }
    });

    // Fast path: check if element contains text node only
    if (elem.body.length === 1 && elem.body[0] instanceof ENDText) {
        stats.text = elem.body[0] as ENDText;
    } else {
        walk(elem, node => {
            if (dynamicContent.has(node.type)) {
                stats.staticContent = false;
                return true;
            }

            if (node instanceof ENDAddClassStatement) {
                stats.dynamicAttributes.add('class');
            } else if (node instanceof ENDAttributeStatement) {
                // XXX technically, attribute statement promotes attributes
                // to dynamic only if it’s inside control statement (if, choose,
                // for-each) but requires more code analysis.
                // For now, simply assume that all attributes in statement are dynamic
                node.attributes.forEach(attr => {
                    if (attr.name instanceof Identifier) {
                        stats.dynamicAttributes.add(attr.name.name);
                    } else if (attr.name instanceof Program) {
                        stats.attributeExpressions = true;
                    }
                });
            }

            return false;
        });
    }

    return stats;
}

/**
 * Walks over contents of given element and invokes `callback` for each body item.
 * A `callback` must return `true` if walker should visit contents of context node,
 * otherwise it will continue to next node
 */
function walk(elem: ENDStatement, callback: (node: ENDStatement) => boolean): void {
    const visit = (node: ENDStatement): void => {
        if (callback(node) === true) {
            walk(node, callback);
        }
    };

    if (elem instanceof ENDElement) {
        elem.body.forEach(visit);
    } else if (elem instanceof ENDIfStatement) {
        elem.consequent.forEach(visit);
    } else if (elem instanceof ENDChooseStatement) {
        elem.cases.forEach(branch => branch.consequent.forEach(visit));
    } else if (elem instanceof ENDForEachStatement) {
        elem.body.forEach(visit);
    }
}
