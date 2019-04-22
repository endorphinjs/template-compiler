import { ENDElement, ENDTemplate, ENDAttributeStatement, ENDStatement, ENDAttribute, Node, Literal } from '@endorphinjs/template-parser';
import { SourceNode } from 'source-map';
import Entity from './Entity';
import UsageStats from './UsageStats';
import CompileState from '../compile-state';
import { isElement, isExpression, isLiteral, sn, isIdentifier, qStr, getControlName } from '../utils';
import TextEntity from './TextEntity';
import { Chunk } from '../types';
import { AstContinue } from '../template-visitors';

const dynamicContent = new Set(['ENDIfStatement', 'ENDChooseStatement', 'ENDForEachStatement']);

export default class ElementEntity extends Entity {
    private _injector: Entity;
    readonly injectorUsage = new UsageStats();

    /** Whether element contains partials */
    hasPartials: boolean;

    /**
     * List of element’s attribute names whose values are expressions,
     * e.g. `attr={foo}` or `attr="foo {bar}"`
     */
    dynamicAttributes: Set<string> = new Set();

    /** List of element’s events which can be updated in runtime */
    dynamicEvents: Set<string> = new Set();

    /** Whether element contains attribute expressions, e.g. `{foo}="bar"` */
    attributeExpressions: boolean;

    hasAnimationOut: boolean;

    constructor(readonly node: ENDElement | ENDTemplate | null, readonly state: CompileState) {
        super(node && isElement(node) ? node.name.name : 'target', state);
        if (node) {
            this.collectStats(node);
        } else {
            // Empty node means we’re in element defined in outer block
            // (for example, in conditional content block). In this case,
            // we should always use injector to fill contents, which shall be
            // passed as argument to block function
            this._injector = new Entity('injector', state);
            this._injector.name = 'injector';
        }
    }

    /** Symbol for referencing element’s injector */
    get injector(): SourceNode {
        const { renderContext } = this.state;
        this.injectorUsage.use(renderContext);

        if (!this._injector) {
            // First time injector usage. Create entity which will mount it
            this._injector = new Entity(this.state.scopeSymbol('inj'), this.state);
            this._injector.setMount(() => sn([`${this.state.runtime('createInjector')}(`, this.getSymbol(), `)`]));
            this.children.unshift(this._injector);
        }

        return this._injector.getSymbol();
    }

    /** Indicates that element context should use injector to operate */
    get usesInjector(): boolean {
        return this._injector != null;
    }

    /** Indicates that current element is a component */
    get isComponent(): boolean {
        return isElement(this.node) && this.state.isComponent(this.node);
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

    add(entity: Entity) {
        if ((entity instanceof ElementEntity || entity instanceof TextEntity) && entity.code.mount) {
            entity.setMount(() => {
                return this.usesInjector
                    ? sn([`${this.state.runtime('insert')}(`, this.injector, `, `, entity.code.mount, `)`])
                    : sn([this.getSymbol(), `.appendChild(`, entity.code.mount, `)`]);
            });
        }

        super.add(entity);
    }

    /**
     * Sets current entity content by receiving entities from given AST nodes
     */
    setContent(nodes: Node[], next: AstContinue): this {
        nodes.forEach(statement => {
            const entity = next(statement);
            entity && this.add(entity);
        });
        return this;
    }

    private collectStats(elem: ENDElement | ENDTemplate) {
        // Collect stats about given element
        if (elem.type === 'ENDElement') {
            elem.attributes.forEach(attr => {
                if (isExpression(attr.name)) {
                    this.attributeExpressions = true;
                } else if (attr.value && !isLiteral(attr.value)) {
                    this.dynamicAttributes.add(attr.name.name);
                }
            });

            this.hasAnimationOut = elem.directives.some(attr => attr.prefix === 'animate' && attr.name === 'out');
        }

        walk(elem, node => {
            if (node.type === 'ENDPartialStatement') {
                this.hasPartials = true;
            } else if (node.type === 'ENDAddClassStatement') {
                this.dynamicAttributes.add('class');
            } else if (node.type === 'ENDAttributeStatement') {
                // Attribute statements in top-level element context are basically
                // the same as immediate attributes of element
                this.attributesStats(node);
            }

            return dynamicContent.has(node.type);
        });
    }

    private attributesStats(node: ENDAttributeStatement) {
        node.attributes.forEach(attr => {
            if (isExpression(attr.name)) {
                this.attributeExpressions = true;
            } else {
                this.dynamicAttributes.add(attr.name.name);
            }
        });
        node.directives.forEach(directive => {
            if (directive.prefix === 'on') {
                this.dynamicEvents.add(directive.name);
            } else if (directive.prefix === 'class') {
                this.dynamicAttributes.add('class');
            }
        });
    }
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

/**
 * Generates element create code
 */
export function createElement(node: ENDElement, state: CompileState, text?: Literal): Chunk {
    const elemName = node.name.name;
    const srcNode = node.name;

    if (getControlName(elemName) === 'self') {
        // Create component which points to itself
        return sn([`${state.runtime('createComponent')}(${state.host}.nodeName, ${state.host}).componentModel.definition, ${state.host})`], srcNode);
    }

    if (state.isComponent(node)) {
        // Create component
        return sn([`${state.runtime('createComponent')}(${qStr(elemName)}, ${state.getComponent(node)}, ${state.host})`], srcNode);
    }

    // Create plain DOM element
    const nodeName = getNodeName(elemName);
    const nsSymbol = state.namespace(nodeName.ns);

    if (text) {
        const textValue = qStr(text.value as string);
        return nsSymbol
            ? sn(`${state.runtime('elemNSWithText')}(${qStr(nodeName.name)}, ${textValue}, ${nsSymbol}${cssScopeArg(state)})`, srcNode)
            : sn(`${state.runtime('elemWithText')}(${qStr(elemName)}, ${textValue}${cssScopeArg(state)})`, srcNode);
    }

    return nsSymbol
        ? sn(`${state.runtime('elemNS')}(${qStr(nodeName.name)}, ${nsSymbol}${cssScopeArg(state)})`, srcNode)
        : sn(`${state.runtime('elem')}(${qStr(elemName)}${cssScopeArg(state)})`, srcNode);
}

export function cssScopeArg(state: CompileState): string {
    return state.options.cssScope ? `, ${state.cssScopeSymbol}` : '';
}

export function getNodeName(localName: string): { ns?: string, name: string } {
    const parts = localName.split(':');
    let ns: string, name: string;
    if (parts.length > 1) {
        ns = parts.shift();
        name = parts.join(':');
    } else {
        name = localName;
    }

    return { ns, name };
}
