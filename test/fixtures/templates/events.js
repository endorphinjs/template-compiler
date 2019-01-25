import { elem, addEvent, updateBlock, mountBlock, finalizeEvents, createInjector } from "@endorphinjs/endorphin";

export default function $$template0(host, scope) {
	const target0 = host.componentView;
	const main0 = target0.appendChild(elem("main", host));
	const injector0 = scope.$_injector0 = createInjector(main0);
	function handler0(event) {
		const method1 = host.method1 || host.componentModel.definition.method1;
		method1(host.props.foo, host.props.bar, host, event, this);
	}
	addEvent(injector0, "click", scope.$_handler0 = handler0);
	scope.$_block0 = mountBlock(host, injector0, $$conditionEntry0);
	finalizeEvents(injector0);
	return $$template0Update;
}

function $$template0Update(host, scope) {
	const injector0 = scope.$_injector0;
	addEvent(injector0, "click", scope.$_handler0);
	updateBlock(scope.$_block0);
	finalizeEvents(injector0);
}

function $$conditionContent0(host, injector, scope) {
	function handler0(event) {
		const method2 = host.method2 || host.componentModel.definition.method2;
		method2(host.props.foo, host.props.bar, host, event, this);
	}
	addEvent(injector, "click", scope.$_handler1 = handler0);
	return $$conditionContent0Update;
}

function $$conditionContent0Update(host, injector, scope) {
	const injector0 = injector;
	addEvent(injector0, "click", scope.$_handler1);
}

function $$conditionEntry0(host) {
	if (host.props.c1) {
		return $$conditionContent0;
	} 
}