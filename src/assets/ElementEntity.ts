import { ENDElement, ENDTemplate, ENDStatement, ENDAttribute, Literal, ENDAttributeValue, ENDDirective } from '@endorphinjs/template-parser';
import { SourceNode } from 'source-map';
import Entity, { entity } from './Entity';
import UsageStats from './UsageStats';
import CompileState from './CompileState';
import { isElement, isExpression, isLiteral, sn, isIdentifier, qStr, getControlName, getAttrValue, runtime } from '../utils';
import TextEntity from './TextEntity';
import { Chunk, ChunkList } from '../types';
import VariableEntity from './VariableEntity';
import { ENDCompileError } from '../error';

const dynamicContent = new Set(['ENDIfStatement', 'ENDChooseStatement', 'ENDForEachStatement']);

export default class ElementEntity extends Entity {
    private _injector: Entity;
    readonly injectorUsage = new UsageStats();

    /** Indicates current entity is a *registered* DOM component */
    isComponent: boolean = false;

    /** Whether element contains partials */
    hasPartials: boolean;

    /** Whether element contents is static */
    isStaticContent: boolean = true;

    /**
     * List of element’s attribute names whose values are expressions,
     * e.g. `attr={foo}` or `attr="foo {bar}"`
     */
    dynamicAttributes: Set<string> = new Set();

    /** List of element’s events which can be updated in runtime */
    dynamicEvents: Set<string> = new Set();

    /** Whether element contains attribute expressions, e.g. `{foo}="bar"` */
    attributeExpressions: boolean;

    animateIn?: ENDAttributeValue;
    animateOut?: ENDAttributeValue;
    slotUpdate: { [slotName: string]: string } = {}

    constructor(readonly node: ENDElement | ENDTemplate | null, readonly state: CompileState) {
        super(node && isElement(node) ? node.name.name : 'target', state);
        if (node) {
            this.isStaticContent = true;
            this.collectStats(node);
            this.isComponent = isElement(node) && state.isComponent(node);
        } else {
            // Empty node means we’re in element defined in outer block
            // (for example, in conditional content block). In this case,
            // we should always use injector to fill contents, which shall be
            // passed as argument to block function
            this.isStaticContent = false;
            this._injector = state.entity('injector');
            this._injector.name = 'injector';
        }
    }

    /** Symbol for referencing element’s injector */
    get injector(): SourceNode {
        const { state } = this;
        this.injectorUsage.use(state.renderContext);

        if (!this._injector) {
            // First time injector usage. Create entity which will mount it
            this._injector = entity('inj', state, {
                mount: () => this.isComponent
                    // For components, contents must be redirected into inner input injector
                    ? sn([this.getSymbol(), '.componentModel.input'])
                    : runtime('createInjector', [this.getSymbol()], state)
            });
            this.children.unshift(this._injector);
        }

        // In case of child block, we should keep symbol as standalone, e.g. create
        // no local references since injector is an argument
        return this._injector.getSymbol(!this.node);
    }

    /** Indicates that element context should use injector to operate */
    get usesInjector(): boolean {
        return this._injector != null;
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

    add(item: Entity) {
        if ((item instanceof ElementEntity || item instanceof TextEntity) && item.code.mount) {
            item.setMount(() =>
                this.isStaticContent ? this.addDOM(item) : this.addInjector(item));
        }

        super.add(item);

        if (this.isComponent && item.name) {
            // Adding content entity into component: we should collect
            // slot update stats
            this.markSlotUpdate(item);
        }
    }

    private markSlotUpdate(entity: Entity) {
        if (!(entity instanceof VariableEntity) && entity.code.update) {
            const slotName = getDestSlotName(entity);
            entity.setUpdate(() => sn([this.getSlotMark(slotName), ' |= ', entity.getUpdate()]));
        }

        for (let i = 0; i < entity.children.length; i++) {
            this.markSlotUpdate(entity.children[i]);
        }
    }

    private getSlotMark(slotName: string): string {
        if (!(slotName in this.slotUpdate)) {
            const varName = this.state.globalSymbol('su');
            this.slotUpdate[slotName] = this.state.blockContext.declareVar(varName, '0');
        }

        return this.slotUpdate[slotName];
    }

    /**
     * Attaches given DOM entity to current element via DOM
     */
    private addDOM(entity: ElementEntity | TextEntity): SourceNode {
        return sn([this.getSymbol(), `.appendChild(`, entity.code.mount, `)`]);
    }

    /**
     * Attaches given DOM entity to current element via injector
     */
    private addInjector(entity: ElementEntity | TextEntity): SourceNode {
        const args: ChunkList = [this.injector, entity.code.mount];
        if (this.isComponent) {
            let slotName = '';
            if (entity instanceof ElementEntity && isElement(entity.node)) {
                slotName = getAttrValue(entity.node, 'slot') as string || '';
            }
            args.push(qStr(slotName));
        }
        return runtime('insert', args, this.state);
    }

    private collectStats(elem: ENDElement | ENDTemplate) {
        // Collect stats about given element
        if (elem.type === 'ENDElement') {
            this.attributesStats(elem.attributes, true);
            this.directiveStats(elem.directives, true);
        }

        walk(elem, node => {
            if (node.type === 'ENDPartialStatement') {
                this.hasPartials = true;
                this.isStaticContent = false;
            } else if (node.type === 'ENDAddClassStatement') {
                this.dynamicAttributes.add('class');
            } else if (node.type === 'ENDAttributeStatement') {
                // Attribute statements in top-level element context are basically
                // the same as immediate attributes of element
                this.attributesStats(node.attributes);
                this.directiveStats(node.directives);
            }

            if (dynamicContent.has(node.type)) {
                this.isStaticContent = false;
                return true;
            }
        });
    }

    private attributesStats(attributes: ENDAttribute[], isElement?: boolean) {
        attributes.forEach(attr => {
            if (isExpression(attr.name)) {
                this.attributeExpressions = true;
            } else if (!isElement || (attr.value && !isLiteral(attr.value))) {
                this.dynamicAttributes.add(attr.name.name);
            }
        });
    }

    private directiveStats(directives: ENDDirective[], isElement?: boolean) {
        directives.forEach(directive => {
            if (directive.prefix === 'on' && !isElement) {
                this.dynamicEvents.add(directive.name);
            } else if (directive.prefix === 'class') {
                this.dynamicAttributes.add('class');
            } else if (directive.prefix === 'animate') {
                // Currently, we allow animations in element only
                if (isElement) {
                    if (directive.name === 'in') {
                        this.animateIn = directive.value;
                    } else if (directive.name === 'out') {
                        this.animateOut = directive.value;
                    } else {
                        new ENDCompileError(`Unknown "${directive.name}" animation directive`, directive);
                    }
                } else {
                    new ENDCompileError(`Animations are allowed in element only`, directive);
                }
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
        return runtime('createComponent', [`${state.host}.nodeName`, `${state.host}.componentModel.definition`, state.host], state, srcNode);
    }

    if (state.isComponent(node)) {
        // Create component
        return runtime('createComponent', [qStr(elemName), state.getComponent(node), state.host], state, srcNode);
    }

    // Create plain DOM element
    const cssScope = state.options.cssScope ? `, ${state.cssScopeSymbol}` : null;
    const nodeName = getNodeName(elemName);
    const nsSymbol = state.namespace(nodeName.ns);

    if (text) {
        const textValue = qStr(text.value as string);
        return nsSymbol
            ? runtime('elemNSWithText', [qStr(nodeName.name), textValue, nsSymbol, cssScope], state, srcNode)
            : runtime('elemWithText', [qStr(elemName), textValue, cssScope], state, srcNode);
    }

    return nsSymbol
        ? runtime('elemNS', [qStr(nodeName.name), nsSymbol, cssScope], state, srcNode)
        : runtime('elem', [qStr(elemName), cssScope], state, srcNode);
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

/**
 * Returns destination slot name from given entity
 */
function getDestSlotName(entity: Entity): string {
    if (entity instanceof ElementEntity && entity.node.type === 'ENDElement') {
        return getAttrValue(entity.node, 'slot') as string || '';
    }

    return '';
}
