import { elem, elemWithText, insert, addStaticEvent, mountIterator, updateIterator, unmountIterator, createInjector, addDisposeCallback } from "@endorphinjs/endorphin";

export default function $$template0(host, scope) {
	const target0 = host.componentView;
	const ul0 = target0.appendChild(elem("ul"));
	const injector0 = createInjector(ul0);
	$$vars0(host, scope);
	scope.$_iter0 = mountIterator(host, injector0, $$iteratorExpr0, $$iteratorBlock0);
	$$vars2(host, scope);
	addDisposeCallback(host, $$template0Unmount);
	return $$template0Update;
}

function $$template0Update(host, scope) {
	$$vars0(host, scope);
	updateIterator(scope.$_iter0);
	$$vars2(host, scope);
}

function $$template0Unmount(scope) {
	scope.$_iter0 = unmountIterator(scope.$_iter0);
}

function $$vars0(host, scope) {
	scope.foo = 1;
}

function $$iteratorExpr0(host) {
	return host.props.items;
}

function $$vars1(host, scope) {
	scope.bar = scope.foo;
}

function $$iteratorBlock0(host, injector, scope) {
	$$vars1(host, scope);
	const li0 = insert(injector, elemWithText("li", "item"));
	function handler0(event) {
		if (!host.componentModel) { return; }
		host.componentModel.definition.handleClick(scope.index, scope.foo, scope.bar, host, event, this);
	}
	addStaticEvent(li0, "click", handler0);
	return $$iteratorBlock0Update;
}

function $$iteratorBlock0Update(host, injector, scope) {
	$$vars1(host, scope);
}

function $$vars2(host, scope) {
	scope.foo = 2;
}