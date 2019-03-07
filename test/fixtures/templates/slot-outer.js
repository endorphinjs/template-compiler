import { elemWithText, createComponent, setAttribute, insert, mountBlock, updateBlock, unmountBlock, mountIterator, updateIterator, unmountIterator, mountComponent, updateComponent, unmountComponent, addDisposeCallback, markSlotUpdate } from "@endorphinjs/endorphin";
import * as SubComponent from "./slot-inner.html";

export default function $$template0(host, scope) {
	const target0 = host.componentView;
	target0.appendChild(elemWithText("h1", "Hello world"));
	const subComponent0 = scope.$_subComponent0 = target0.appendChild(createComponent("sub-component", SubComponent, host));
	const injector0 = scope.$_injector0 = subComponent0.componentModel.input;
	setAttribute(injector0, "id", host.props.id);
	scope.foo = host.props.bar;
	insert(injector0, elemWithText("div", "foo"));
	scope.$_block0 = mountBlock(host, injector0, $$conditionEntry0);
	scope.$_block1 = mountBlock(host, injector0, $$conditionEntry1);
	scope.$_iter0 = mountIterator(host, injector0, $$iteratorExpr0, $$iteratorBlock0);
	scope.$_block2 = mountBlock(host, injector0, $$conditionEntry2);
	mountComponent(subComponent0);
	addDisposeCallback(host, $$template0Unmount);
	return $$template0Update;
}

function $$template0Update(host, scope) {
	const injector0 = scope.$_injector0;
	let s__subComponent0 = 0;
	s__subComponent0 |= setAttribute(injector0, "id", host.props.id);
	scope.foo = host.props.bar;
	s__subComponent0 |= updateBlock(scope.$_block0);
	s__subComponent0 |= updateBlock(scope.$_block1);
	s__subComponent0 |= updateIterator(scope.$_iter0);
	s__subComponent0 |= updateBlock(scope.$_block2);
	markSlotUpdate(scope.$_subComponent0, "", s__subComponent0);
	updateComponent(scope.$_subComponent0);
	return s__subComponent0;
}

function $$template0Unmount(scope) {
	scope.$_block0 = unmountBlock(scope.$_block0);
	scope.$_block1 = unmountBlock(scope.$_block1);
	scope.$_iter0 = unmountIterator(scope.$_iter0);
	scope.$_block2 = unmountBlock(scope.$_block2);
	scope.$_subComponent0 = unmountComponent(scope.$_subComponent0);
	scope.$_injector0 = null;
}

function $$conditionContent0(host, injector) {
	insert(injector, elemWithText("p", "bar"));
}

function $$conditionEntry0(host) {
	if (host.props.c1) {
		return $$conditionContent0;
	} 
}

function $$conditionContent1(host, injector) {
	const p0 = insert(injector, elemWithText("p", "bar"), "header");
	p0.setAttribute("slot", "header");
}

function $$conditionEntry1(host) {
	if (host.props.c2) {
		return $$conditionContent1;
	} 
}

function $$iteratorExpr0(host) {
	return host.props.items;
}

function $$iteratorBlock0(host, injector) {
	insert(injector, elemWithText("div", "item"));
	const div0 = insert(injector, elemWithText("div", "item footer"), "footer");
	div0.setAttribute("slot", "footer");
}

function $$conditionContent2(host, injector) {
	const div0 = insert(injector, elemWithText("div", "Got error"), "error");
	div0.setAttribute("slot", "error");
}

function $$conditionEntry2(host) {
	if (host.props.error) {
		return $$conditionContent2;
	} 
}