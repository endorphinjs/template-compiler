import { elem, setRef, insert, updateBlock, mountBlock, createComponent, mountComponent, updateComponent, createInjector, finalizeRefs, markSlotUpdate } from "@endorphinjs/endorphin";
import * as SlotInner from "./slot-inner.html";

export default function $$template0(host, scope) {
	const target0 = host.componentView;
	const main0 = scope.$_main0 = target0.appendChild(elem("main"));
	const injector0 = createInjector(main0);
	setRef(host, "main", main0);
	const div0 = scope.$_div0 = insert(injector0, elem("div"));
	setRef(host, "header", div0);
	scope.$_block0 = mountBlock(host, injector0, $$conditionEntry0);
	const footer0 = scope.$_footer0 = insert(injector0, elem("footer"));
	setRef(host, host.props.dynRef, footer0);
	const slotInner0 = scope.$_slotInner0 = insert(injector0, createComponent("slot-inner", SlotInner, host));
	setRef(host, "addon", slotInner0);
	mountComponent(slotInner0);
	finalizeRefs(host);
	return $$template0Update;
}

function $$template0Update(host, scope) {
	setRef(host, "main", scope.$_main0);
	setRef(host, "header", scope.$_div0);
	updateBlock(scope.$_block0);
	setRef(host, host.props.dynRef, scope.$_footer0);
	let s__slotInner0 = 0;
	s__slotInner0 |= setRef(host, "addon", scope.$_slotInner0);
	markSlotUpdate(scope.$_slotInner0, "", s__slotInner0);
	updateComponent(scope.$_slotInner0);
	finalizeRefs(host);
	return s__slotInner0;
}

function $$conditionContent0(host, injector, scope) {
	const span0 = scope.$_span0 = insert(injector, elem("span"));
	setRef(host, "header", span0);
	return $$conditionContent0Update;
}

function $$conditionContent0Update(host, injector, scope) {
	setRef(host, "header", scope.$_span0);
}

function $$conditionEntry0(host) {
	if (host.props.c1) {
		return $$conditionContent0;
	} 
}