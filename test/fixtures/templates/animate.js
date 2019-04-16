import { elemWithText, insert, elem, setAttribute, animateIn, animateOut, text, mountBlock, updateBlock, unmountBlock, mountInnerHTML, updateInnerHTML, unmountInnerHTML, mountPartial, updatePartial, unmountPartial, addDisposeCallback, mountIterator, updateIterator, unmountIterator, createComponent, mountComponent, updateComponent, unmountComponent, finalizeAttributes, finalizeEvents, createInjector, finalizeRefs } from "@endorphinjs/endorphin";
import * as InnerComponent from "./inner-component.html";

export const partials = {
	test: {
		body: $$partialTest0,
		defaults: {}
	}
};

function $$partialTest0(host, injector) {
	insert(injector, elemWithText("p", "partial"));
}

export default function $$template0(host, scope) {
	const target0 = host.componentView;
	const injector0 = createInjector(target0);
	insert(injector0, elemWithText("p", "test"));
	scope.$_block1 = mountBlock(host, injector0, $$conditionEntry0);
	finalizeRefs(host);
	addDisposeCallback(host, $$template0Unmount);
	return $$template0Update;
}

function $$template0Update(host, scope) {
	updateBlock(scope.$_block1);
	finalizeRefs(host);
}

function $$template0Unmount(scope) {
	scope.$_block1 = unmountBlock(scope.$_block1);
}

function $$attrValue0(host) {
	return "left: " + (host.props.left) + "px";
}

function $$conditionContent1(host, injector) {
	insert(injector, text("\n            bar\n        "));
}

function $$conditionEntry1(host) {
	if (host.props.foo) {
		return $$conditionContent1;
	} 
}

function $$getHTML0(host) {
	return host.props.html;
}

function $$iteratorExpr0(host) {
	return host.props.items;
}

function $$iteratorBlock0(host, injector, scope) {
	scope.$_partial0 = mountPartial(host, injector, host.props['partial:test'] || partials.test, {});
	addDisposeCallback(injector, $$iteratorBlock0Unmount);
	return $$iteratorBlock0Update;
}

function $$iteratorBlock0Update(host, injector, scope) {
	updatePartial(scope.$_partial0, host.props['partial:test'] || partials.test, {});
}

function $$iteratorBlock0Unmount(scope) {
	scope.$_partial0 = unmountPartial(scope.$_partial0);
}

function $$conditionContent0(host, injector, scope) {
	const div0 = scope.$_div0 = insert(injector, elem("div"));
	const injector0 = scope.$_injector0 = createInjector(div0);
	setAttribute(injector0, "class", "overlay");
	setAttribute(injector0, "style", $$attrValue0(host, scope));
	scope.$_block0 = mountBlock(host, injector0, $$conditionEntry1);
	scope.$_html0 = mountInnerHTML(host, injector0, $$getHTML0);
	scope.$_iter0 = mountIterator(host, injector0, $$iteratorExpr0, $$iteratorBlock0);
	const innerComponent0 = scope.$_innerComponent0 = insert(injector0, createComponent("inner-component", InnerComponent, host));
	mountComponent(innerComponent0);
	finalizeAttributes(injector0);
	finalizeEvents(injector0);
	animateIn(div0, "show");
	addDisposeCallback(injector, $$conditionContent0Unmount);
	return $$conditionContent0Update;
}

function $$conditionContent0Update(host, injector, scope) {
	const injector0 = scope.$_injector0;
	setAttribute(injector0, "class", "overlay");
	setAttribute(injector0, "style", $$attrValue0(host, scope));
	updateBlock(scope.$_block0);
	updateInnerHTML(scope.$_html0);
	updateIterator(scope.$_iter0);
	updateComponent(scope.$_innerComponent0);
	finalizeAttributes(injector0);
	finalizeEvents(injector0);
	return 0;
}

function $$conditionContent0Unmount(scope) {
	scope.$_div0 = animateOut(scope.$_div0, "hide", scope, function(scope) {
		scope.$_block0 = unmountBlock(scope.$_block0);
		scope.$_html0 = unmountInnerHTML(scope.$_html0);
		scope.$_iter0 = unmountIterator(scope.$_iter0);
		scope.$_innerComponent0 = unmountComponent(scope.$_innerComponent0);
	});
	scope.$_injector0 = null;
}

function $$conditionEntry0(host) {
	if (host.props.enabled) {
		return $$conditionContent0;
	} 
}