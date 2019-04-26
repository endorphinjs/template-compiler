import { elemWithText, mountBlock, createInjector, elem, insert, updateBlock, unmountBlock, text, addDisposeCallback } from "@endorphinjs/endorphin";

function if$1Body$0(host, injector) {
	insert(injector, elemWithText("div", "top 2"));
}

function if$1Entry$0(host) {
	if (host.props.expr2) {
		return if$1Body$0;
	}
}

function if$2Body$0(host, injector) {
	insert(injector, elemWithText("div", "top 3"));
	insert(injector, text("\n            top 3.1\n        "));
}

function if$2Entry$0(host) {
	if (host.props.expr3) {
		return if$2Body$0;
	}
}

function if$0Body$0(host, injector, scope) {
	const p$0 = insert(injector, elem("p"));
	p$0.appendChild(elemWithText("strong", "top 1"));
	scope.if$1 = mountBlock(host, injector, if$1Entry$0);
	scope.if$2 = mountBlock(host, injector, if$2Entry$0);
	addDisposeCallback(host, if$0Body$0Unmount);
	return if$0Body$0Update;
}

function if$0Body$0Update(host, scope) {
	updateBlock(scope.if$1);
	updateBlock(scope.if$2);
}

function if$0Body$0Unmount(scope) {
	unmountBlock(scope.if$1);
	unmountBlock(scope.if$2);
}

function if$0Entry$0(host) {
	if (host.props.expr1) {
		return if$0Body$0;
	}
}

function choose$0Body$0(host, injector) {
	insert(injector, elemWithText("div", "sub 1"));
}

function choose$0Body$1(host, injector) {
	insert(injector, elemWithText("div", "sub 2"));
}

function choose$0Body$2(host, injector) {
	insert(injector, elemWithText("div", "sub 3"));
}

function choose$0Entry$0(host) {
	if ((host.props.expr1 === 1)) {
		return choose$0Body$0;
	} else if ((host.props.expr1 === 2)) {
		return choose$0Body$1;
	} else {
		return choose$0Body$2;
	}
}

function template$0(host, scope) {
	const target$0 = host.componentView;
	const inj$0 = createInjector(target$0);
	insert(inj$0, elemWithText("h1", "Hello world"));
	scope.if$0 = mountBlock(host, inj$0, if$0Entry$0);
	const blockquote$0 = insert(inj$0, elem("blockquote"));
	const inj$1 = createInjector(blockquote$0);
	insert(inj$1, elemWithText("p", "Lorem ipsum 1"));
	scope.choose$0 = mountBlock(host, inj$1, choose$0Entry$0);
	insert(inj$1, elemWithText("p", "Lorem ipsum 2"));
	addDisposeCallback(host, template$0Unmount);
	return template$0Update;
}

function template$0Update(host, scope) {
	updateBlock(scope.if$0);
	updateBlock(scope.choose$0);
}

function template$0Unmount(scope) {
	unmountBlock(scope.if$0);
	unmountBlock(scope.choose$0);
}

export default template$0;