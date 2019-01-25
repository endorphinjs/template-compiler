import { elem, elemWithText, insert, addStaticEvent, updateIterator, mountIterator, createInjector } from "@endorphinjs/endorphin";

export default function $$template0(host, scope) {
	const target0 = host.componentView;
	const ul0 = target0.appendChild(elem("ul", host));
	const injector0 = createInjector(ul0);
	scope.foo = 1;
	scope.$_iter0 = mountIterator(host, injector0, $$iteratorExpr0, $$iteratorBlock0);
	scope.foo = 2;
	return $$template0Update;
}

function $$template0Update(host, scope) {
	scope.foo = 1;
	updateIterator(scope.$_iter0);
	scope.foo = 2;
}

function $$iteratorExpr0(host) {
	return host.props.items;
}

function $$iteratorBlock0(host, injector, scope) {
	scope.bar = scope.foo;
	const li0 = insert(injector, elemWithText("li", "item", host));
	function handler0(event) {
		const handleClick = host.handleClick || host.componentModel.definition.handleClick;
		handleClick(scope.index, scope.foo, scope.bar, host, event, this);
	}
	addStaticEvent(li0, "click", handler0);
	return $$iteratorBlock0Update;
}

function $$iteratorBlock0Update(host, injector, scope) {
	scope.bar = scope.foo;
}