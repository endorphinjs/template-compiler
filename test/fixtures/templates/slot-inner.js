import { elem, insert, elemWithText, mountSlot, updateBlock, mountBlock, createInjector } from "@endorphinjs/endorphin";

export default function $$template0(host, scope) {
	const target0 = host.componentView;
	const div0 = target0.appendChild(elem("div"));
	const injector0 = createInjector(div0);
	div0.setAttribute("class", "container");
	const slot0 = insert(injector0, elem("slot"));
	slot0.setAttribute("name", "header");
	mountSlot(host, "header", slot0, $$slotHeaderContent0);
	insert(injector0, elemWithText("p", "content"));
	const slot1 = insert(injector0, elem("slot"));
	mountSlot(host, "", slot1);
	scope.$_block0 = mountBlock(host, injector0, $$conditionEntry0);
	scope.$_block1 = mountBlock(host, injector0, $$conditionEntry1);
	return $$template0Update;
}

function $$template0Update(host, scope) {
	updateBlock(scope.$_block0);
	updateBlock(scope.$_block1);
}

function $$slotHeaderContent0(host, injector) {
	insert(injector, elemWithText("h2", "Default header"));
}

function $$conditionContent0(host, injector) {
	const slot0 = insert(injector, elem("slot"));
	slot0.setAttribute("name", "error");
	mountSlot(host, "error", slot0);
}

function $$conditionEntry0(host) {
	if (host.props.showError) {
		return $$conditionContent0;
	} 
}

function $$slotFooterContent0(host, injector) {
	insert(injector, elemWithText("footer", "Default footer"));
}

function $$conditionContent1(host, injector) {
	const slot0 = insert(injector, elem("slot"));
	slot0.setAttribute("name", "footer");
	mountSlot(host, "footer", slot0, $$slotFooterContent0);
}

function $$conditionEntry1(host) {
	if (host.props.showFooter) {
		return $$conditionContent1;
	} 
}