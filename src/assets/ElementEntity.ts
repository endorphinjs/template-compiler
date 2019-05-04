import { ENDElement, ENDTemplate, ENDStatement, ENDAttribute, Literal, ENDAttributeValue, ENDDirective } from '@endorphinjs/template-parser';
import { SourceNode } from 'source-map';
import Entity, { entity } from './Entity';
import UsageStats from './UsageStats';
import CompileState from './CompileState';
import { isElement, isExpression, isLiteral, sn, isIdentifier, qStr, getControlName, getAttrValue, runtime, propSetter, unmount } from '../utils';
import TextEntity from './TextEntity';
import { Chunk, ChunkList } from '../types';
import VariableEntity from './VariableEntity';
import { ENDCompileError } from '../error';
import { compileAttributeValue } from './AttributeEntity';
import { toObjectLiteral } from './object';

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
            this.collectStats();
            if (isElement(node)) {
                this.isComponent = state.isComponent(node);
            }
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
    isDynamicAttribute(attr: ENDAttribute): boolean {
        if (this.hasPartials || this.attributeExpressions) {
            return true;
        }

        if (isIdentifier(attr.name)) {
            return this.dynamicAttributes.has(attr.name.name);
        }

        return attr.value
            ? isExpression(attr.value) || attr.value.type === 'ENDAttributeValueExpression'
            : false;
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

    /**
     * Adds entity to mount, update and unmount component
     * Since component should be mounted and updated *after* it’s
     * content was rendered, we should add mount and update code
     * as a separate entity after element content
     */
    mountComponent() {
        const { state } = this;
        this.add(state.entity({
            mount: () => {
                const staticProps = this.getStaticProps();
                const staticPropsArg = staticProps.size
                    ? toObjectLiteral(staticProps, state, 1) : null;
                return runtime('mountComponent', [this.getSymbol(), staticPropsArg], state);
            },
            update: () => runtime('updateComponent', [this.getSymbol()], state),
            unmount: () => unmount('unmountComponent', this.getSymbol(), state)
        }));

        // Add empty source node to skip automatic symbol nulling
        // in unmount function
        this.setUnmount(() => sn());
    }

    /**
     * Adds entity to mark slot updates
     */
    markSlots() {
        Object.keys(this.slotUpdate).forEach(slotName => {
            this.add(this.state.entity({
                update: () => runtime('markSlotUpdate', [this.getSymbol(), qStr(slotName), this.slotUpdate[slotName]], this.state)
            }))
        });
    }

    /**
     * Adds entity to finalize attributes of current element
     */
    finalizeAttributes() {
        const { state } = this;
        this.add(state.entity('attr', {
            shared: () => runtime('finalizeAttributes', [this.injector], state)
        }));
    }

    /**
     * Adds entity to finalize attributes of current element
     */
    finalizeEvents() {
        const { state } = this;
        this.add(state.entity({
            shared: () => runtime('finalizeEvents', [this.injector, state.host, state.scope], state)
        }));
    }

    /**
     * Adds entity to set named ref to current element
     */
    setRef(refName: string) {
        const { state } = this;
        this.add(state.entity({
            shared: () => runtime('setRef', [state.host, refName, this.getSymbol()], state)
        }));
    }

    /**
     * Adds entity to animate current element
     */
    animate() {
        if (this.animateIn || this.animateOut) {
            const { state } = this;
            const anim = state.entity();
            if (this.animateIn) {
                anim.setMount(() => runtime('animateIn', [this.getSymbol(), compileAttributeValue(this.animateIn, state), cssScopeArg(state)], state));
            }

            if (this.animateOut) {
                // We need to create a callback function to properly unmount
                // contents of current element
                const entities: Entity[] = [];
                const callback = state.runBlock('animateOut', block => {
                    const transfer = (item: Entity) => {
                        item.children.forEach(transfer);
                        if (item.code.unmount) {
                            const unmountEntity = state.entity();
                            unmountEntity.code.mount = item.code.unmount;
                            item.code.unmount = null;
                            block.scopeUsage.use('mount');
                            entities.push(unmountEntity);
                        }
                    };

                    transfer(this);
                    return entities;
                });
                if (entities.length) {
                    anim.setUnmount(() => runtime('animateOut', [this.getSymbol(), compileAttributeValue(this.animateOut, state), state.scope, callback, cssScopeArg(state)], state));
                } else {
                    anim.setUnmount(() => runtime('animateOut', [this.getSymbol(), compileAttributeValue(this.animateOut, state), cssScopeArg(state)], state));
                }
            }

            this.add(anim);
        }
    }

    /**
     * Returns map of static props of current element
     */
    getStaticProps(): Map<Chunk, Chunk> {
        const props: Map<Chunk, Chunk> = new Map();

        if (this.node.type === 'ENDElement') {
            const { attributes, directives } = this.node;
            const { state } = this;

            attributes.forEach(attr => {
                if (!this.isDynamicAttribute(attr)) {
                    props.set(propSetter(attr.name, this.state), compileAttributeValue(attr.value, state, 'params'));
                }
            });

            directives.forEach(dir => {
                if (dir.prefix === 'partial') {
                    const value = compileAttributeValue(dir.value, state, 'component');
                    props.set(
                        qStr(`${dir.prefix}:${dir.name}`),
                        runtime('assign', [`{ ${state.host} }`, sn([`${state.partials}[`, value, ']'])], state)
                    );
                }
            });
        }

        return props;
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
    private addDOM(entity: Entity): SourceNode {
        return sn([this.getSymbol(), `.appendChild(`, entity.code.mount, `)`]);
    }

    /**
     * Attaches given DOM entity to current element via injector
     */
    private addInjector(entity: Entity): SourceNode {
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

    private collectStats() {
        // Collect stats about given element
        const { node } = this;

        if (isElement(node)) {
            this.attributesStats(node.attributes, true);
            this.directiveStats(node.directives, true);
        }

        walk(node, node => {
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
    const cssScope = state.options.cssScope ? state.cssScopeSymbol : null;
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
