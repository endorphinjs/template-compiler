import { elem, insert, renderSlot, elemWithText, updateBlock, mountBlock, createInjector } from "@endorphinjs/endorphin";

export default function $$template0(host, scope) {
	const target0 = host.componentView;
	const div0 = target0.appendChild(elem("div", host));
	const injector0 = createInjector(div0);
	div0.setAttribute("class", "container");
	const slot0 = insert(injector0, elem("slot", host));
	const injector1 = createInjector(slot0);
	slot0.setAttribute("name", "header");
	scope.$_slot0 = mountBlock(host, injector1, $$slotHeader0);
	insert(injector0, elemWithText("p", "content", host));
	const slot1 = scope.$_slot1 = insert(injector0, elem("slot", host));
	renderSlot(slot1, host.slots);
	scope.$_block0 = mountBlock(host, injector0, $$conditionEntry0);
	scope.$_block1 = mountBlock(host, injector0, $$conditionEntry1);
	return $$template0Update;
}

function $$template0Update(host, scope) {
	updateBlock(scope.$_slot0);
	renderSlot(scope.$_slot1, host.slots);
	updateBlock(scope.$_block0);
	updateBlock(scope.$_block1);
}

function $$slotHeaderContent0(host, injector) {
	insert(injector, elemWithText("h2", "Default header", host));
}

function $$slotHeader0(host, injector) {
	if(!renderSlot(injector.parentNode, host.slots)) {
		return $$slotHeaderContent0;
	}
}

function $$conditionContent0(host, injector, scope) {
	const slot0 = scope.$_slot2 = insert(injector, elem("slot", host));
	slot0.setAttribute("name", "error");
	renderSlot(slot0, host.slots);
	return $$conditionContent0Update;
}

function $$conditionContent0Update(host, injector, scope) {
	renderSlot(scope.$_slot2, host.slots);
}

function $$conditionEntry0(host) {
	if (host.props.showError) {
		return $$conditionContent0;
	} 
}

function $$slotFooterContent0(host, injector) {
	insert(injector, elemWithText("footer", "Default footer", host));
}

function $$slotFooter0(host, injector) {
	if(!renderSlot(injector.parentNode, host.slots)) {
		return $$slotFooterContent0;
	}
}

function $$conditionContent1(host, injector, scope) {
	const slot0 = insert(injector, elem("slot", host));
	const injector0 = createInjector(slot0);
	slot0.setAttribute("name", "footer");
	scope.$_slot3 = mountBlock(host, injector0, $$slotFooter0);
	return $$conditionContent1Update;
}

function $$conditionContent1Update(host, injector, scope) {
	updateBlock(scope.$_slot3);
}

function $$conditionEntry1(host) {
	if (host.props.showFooter) {
		return $$conditionContent1;
	} 
}