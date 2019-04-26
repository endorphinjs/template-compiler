import { elemWithText, mountBlock, createInjector, elem, text, get, insert, updateBlock, unmountBlock, addDisposeCallback, mountIterator, updateIterator, unmountIterator } from "@endorphinjs/endorphin";

function for$0Select$0(host) {
	return host.props.items;
}

function if$1Body$0(host, injector) {
	insert(injector, elemWithText("strong", "*"));
}

function if$1Entry$0(host, scope) {
	if (get(scope.value, "marked")) {
		return if$1Body$0;
	}
}

function for$0Content$0(host, injector, scope) {
	const li$0 = insert(injector, elem("li"));
	const inj$1 = createInjector(li$0);
	insert(inj$1, text("\n                    item\n                    "));
	scope.if$1 = mountBlock(host, inj$1, if$1Entry$0);
	addDisposeCallback(host, for$0Content$0Unmount);
	return for$0Content$0Update;
}

function for$0Content$0Update(host, scope) {
	updateBlock(scope.if$1);
}

function for$0Content$0Unmount(scope) {
	unmountBlock(scope.if$1);
}

function if$0Body$0(host, injector, scope) {
	insert(injector, elemWithText("p", "will iterate"));
	const ul$0 = insert(injector, elem("ul"));
	const inj$2 = createInjector(ul$0);
	scope.for$0 = mountIterator(host, inj$2, for$0Select$0, for$0Content$0);
	addDisposeCallback(host, if$0Body$0Unmount);
	return if$0Body$0Update;
}

function if$0Body$0Update(host, scope) {
	updateIterator(scope.for$0);
}

function if$0Body$0Unmount(scope) {
	unmountIterator(scope.for$0);
}

function if$0Entry$0(host) {
	if (host.props.items) {
		return if$0Body$0;
	}
}

export default function template$0(host, scope) {
	const target$0 = host.componentView;
	const inj$0 = createInjector(target$0);
	insert(inj$0, elemWithText("h1", "Hello world"));
	scope.if$0 = mountBlock(host, inj$0, if$0Entry$0);
	addDisposeCallback(host, template$0Unmount);
	return template$0Update;
}

function template$0Update(host, scope) {
	updateBlock(scope.if$0);
}

function template$0Unmount(scope) {
	unmountBlock(scope.if$0);
}