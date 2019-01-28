import { elemWithText, createComponent, setAttribute, insert, updateBlock, mountBlock, updateIterator, mountIterator, mountComponent, updateComponent } from "@endorphinjs/endorphin";
import * as SubComponent from "./slot-inner.html";

export default function $$template0(host, scope) {
	const target0 = host.componentView;
	target0.appendChild(elemWithText("h1", "Hello world", host));
	const subComponent0 = scope.$_subComponent0 = target0.appendChild(createComponent("sub-component", SubComponent, host));
	const injector0 = scope.$_injector0 = subComponent0.componentModel.input;
	setAttribute(injector0, "id", host.props.id);
	insert(injector0, elemWithText("div", "foo", host));
	scope.$_block0 = mountBlock(host, injector0, $$conditionEntry0);
	scope.$_block1 = mountBlock(host, injector0, $$conditionEntry1);
	scope.$_iter0 = mountIterator(host, injector0, $$iteratorExpr0, $$iteratorBlock0);
	scope.$_block2 = mountBlock(host, injector0, $$conditionEntry2);
	mountComponent(subComponent0);
	return $$template0Update;
}

function $$template0Update(host, scope) {
	const injector0 = scope.$_injector0;
	setAttribute(injector0, "id", host.props.id);
	updateBlock(scope.$_block0);
	updateBlock(scope.$_block1);
	updateIterator(scope.$_iter0);
	updateBlock(scope.$_block2);
	updateComponent(scope.$_subComponent0);
}

function $$conditionContent0(host, injector) {
	insert(injector, elemWithText("p", "bar", host));
}

function $$conditionEntry0(host) {
	if (host.props.c1) {
		return $$conditionContent0;
	} 
}

function $$conditionContent1(host, injector) {
	const p0 = insert(injector, elemWithText("p", "bar", host), "header");
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
	insert(injector, elemWithText("div", "item", host));
	const div0 = insert(injector, elemWithText("div", "item footer", host), "footer");
	div0.setAttribute("slot", "footer");
}

function $$conditionContent2(host, injector) {
	const div0 = insert(injector, elemWithText("div", "Got error", host), "error");
	div0.setAttribute("slot", "error");
}

function $$conditionEntry2(host) {
	if (host.props.error) {
		return $$conditionContent2;
	} 
}