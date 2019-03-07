import { elemWithText, insert, mountBlock, updateBlock, unmountBlock, mountInnerHTML, updateInnerHTML, unmountInnerHTML, createInjector, addDisposeCallback } from "@endorphinjs/endorphin";

export default function $$template0(host, scope) {
	const target0 = host.componentView;
	const injector0 = createInjector(target0);
	insert(injector0, elemWithText("p", "test"));
	scope.$_block0 = mountBlock(host, injector0, $$conditionEntry0);
	scope.$_html0 = mountInnerHTML(host, injector0, $$getHTML0);
	scope.$_block1 = mountBlock(host, injector0, $$conditionEntry1);
	addDisposeCallback(host, $$template0Unmount);
	return $$template0Update;
}

function $$template0Update(host, scope) {
	updateBlock(scope.$_block0);
	updateInnerHTML(scope.$_html0);
	updateBlock(scope.$_block1);
}

function $$template0Unmount(scope) {
	scope.$_block0 = unmountBlock(scope.$_block0);
	scope.$_html0 = unmountInnerHTML(scope.$_html0);
	scope.$_block1 = unmountBlock(scope.$_block1);
}

function $$conditionContent0(host, injector) {
	insert(injector, elemWithText("div", "foo"));
}

function $$conditionEntry0(host) {
	if (host.props.c1) {
		return $$conditionContent0;
	} 
}

function $$getHTML0(host) {
	return host.props.html;
}

function $$conditionContent1(host, injector) {
	insert(injector, elemWithText("p", "bar"));
}

function $$conditionEntry1(host) {
	if (host.props.c2) {
		return $$conditionContent1;
	} 
}