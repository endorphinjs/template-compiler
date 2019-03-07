import { elem, insert, elemWithText, mountSlot, unmountSlot, addDisposeCallback, mountBlock, updateBlock, unmountBlock, createInjector } from "@endorphinjs/endorphin";

export default function $$template0(host, scope) {
	const target0 = host.componentView;
	const div0 = target0.appendChild(elem("div"));
	const injector0 = createInjector(div0);
	div0.setAttribute("class", "container");
	const slot0 = insert(injector0, elem("slot"));
	slot0.setAttribute("name", "header");
	scope.$_slot0 = mountSlot(host, "header", slot0, $$slotHeaderContent0);
	insert(injector0, elemWithText("p", "content"));
	const slot1 = insert(injector0, elem("slot"));
	scope.$_slot1 = mountSlot(host, "", slot1);
	scope.$_block0 = mountBlock(host, injector0, $$conditionEntry0);
	scope.$_block1 = mountBlock(host, injector0, $$conditionEntry1);
	addDisposeCallback(host, $$template0Unmount);
	return $$template0Update;
}

function $$template0Update(host, scope) {
	updateBlock(scope.$_block0);
	updateBlock(scope.$_block1);
}

function $$template0Unmount(scope) {
	scope.$_slot0 = unmountSlot(scope.$_slot0);
	scope.$_slot1 = unmountSlot(scope.$_slot1);
	scope.$_block0 = unmountBlock(scope.$_block0);
	scope.$_block1 = unmountBlock(scope.$_block1);
}

function $$slotHeaderContent0(host, injector) {
	insert(injector, elemWithText("h2", "Default header"));
}

function $$conditionContent0(host, injector, scope) {
	const slot0 = insert(injector, elem("slot"));
	slot0.setAttribute("name", "error");
	scope.$_slot2 = mountSlot(host, "error", slot0);
	addDisposeCallback(injector, $$conditionContent0Unmount);
}

function $$conditionContent0Unmount(scope) {
	scope.$_slot2 = unmountSlot(scope.$_slot2);
}

function $$conditionEntry0(host) {
	if (host.props.showError) {
		return $$conditionContent0;
	} 
}

function $$slotFooterContent0(host, injector) {
	insert(injector, elemWithText("footer", "Default footer"));
}

function $$conditionContent1(host, injector, scope) {
	const slot0 = insert(injector, elem("slot"));
	slot0.setAttribute("name", "footer");
	scope.$_slot3 = mountSlot(host, "footer", slot0, $$slotFooterContent0);
	addDisposeCallback(injector, $$conditionContent1Unmount);
}

function $$conditionContent1Unmount(scope) {
	scope.$_slot3 = unmountSlot(scope.$_slot3);
}

function $$conditionEntry1(host) {
	if (host.props.showFooter) {
		return $$conditionContent1;
	} 
}