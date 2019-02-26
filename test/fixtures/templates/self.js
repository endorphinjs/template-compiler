import { elem, get, createComponent, insert, setAttribute, mountComponent, updateComponent, markSlotUpdate, elemWithText, updateBlock, mountBlock, createInjector } from "@endorphinjs/endorphin";

export default function $$template0(host, scope) {
	const target0 = host.componentView;
	const div0 = target0.appendChild(elem("div"));
	const injector0 = createInjector(div0);
	scope.$_block0 = mountBlock(host, injector0, $$conditionEntry0);
	return $$template0Update;
}

function $$template0Update(host, scope) {
	updateBlock(scope.$_block0);
}

function $$conditionContent0(host, injector, scope) {
	const e_self0 = scope.$_e_self0 = insert(injector, createComponent(host.nodeName, host.componentModel.definition, host));
	const injector0 = scope.$_injector0 = e_self0.componentModel.input;
	setAttribute(injector0, "item", host.props.link);
	mountComponent(e_self0);
	return $$conditionContent0Update;
}

function $$conditionContent0Update(host, injector, scope) {
	const injector0 = scope.$_injector0;
	let s__e_self0 = 0;
	s__e_self0 |= setAttribute(injector0, "item", host.props.link);
	markSlotUpdate(scope.$_e_self0, "", s__e_self0);
	updateComponent(scope.$_e_self0);
	return s__e_self0;
}

function $$conditionContent1(host, injector) {
	insert(injector, elemWithText("div", "Content"));
}

function $$conditionEntry0(host) {
	if (get(host.props.item, "link")) {
		return $$conditionContent0;
	} else {
		return $$conditionContent1;
	} 
}