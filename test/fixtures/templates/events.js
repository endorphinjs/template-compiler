import { createInjector, addEvent, addStaticEvent, removeStaticEvent, elem, mountBlock, updateBlock, unmountBlock, finalizeEvents, addDisposeCallback } from "@endorphinjs/endorphin";
import { emit } from "endorphin/helpers.js";

function onClick$0(evt) {
	this.host.componentModel.definition.method1(this.host.props.foo, this.host.props.bar, this.host, evt, this.target);
}

function onMouseenter$0() {
	emit(this.host, "hover");
}

function onKeypress$0(evt) {
	evt.stopPropagation();
}

function onMousedown$0(e) {
	e.preventDefault();
	emit(this.host, "down", e.pageX, e.pageY);
}

function onClick$1(evt) {
	this.host.componentModel.definition.method2(this.host.props.foo, this.host.props.bar, this.host, evt, this.target);
}

function ifBody$0(host, injector, scope) {
	addEvent(injector, "click", onClick$1, host, scope);
	return ifBody$0Update;
}

function ifBody$0Update(host, injector, scope) {
	addEvent(injector, "click", onClick$1, host, scope);
}

function ifEntry$0(host) {
	if (host.props.c1) {
		return ifBody$0;
	}
}

export default function template$0(host, scope) {
	const target$0 = host.componentView;
	const main$0 = target$0.appendChild(elem("main"));
	const inj$0 = scope.inj$0 = createInjector(main$0);
	addEvent(inj$0, "click", onClick$0, host, scope);
	scope.mouseenter$0 = addStaticEvent(main$0, "mouseenter", onMouseenter$0, host, scope);
	scope.keypress$0 = addStaticEvent(main$0, "keypress", onKeypress$0, host, scope);
	scope.mousedown$0 = addStaticEvent(main$0, "mousedown", onMousedown$0, host, scope);
	scope.if$0 = mountBlock(host, inj$0, ifEntry$0);
	finalizeEvents(inj$0);
	addDisposeCallback(host, template$0Unmount);
	return template$0Update;
}

function template$0Update(host, scope) {
	const { inj$0 } = scope;
	addEvent(inj$0, "click", onClick$0, host, scope);
	updateBlock(scope.if$0);
	finalizeEvents(inj$0);
}

function template$0Unmount(scope) {
	scope.mouseenter$0 = removeStaticEvent(scope.mouseenter$0);
	scope.keypress$0 = removeStaticEvent(scope.keypress$0);
	scope.mousedown$0 = removeStaticEvent(scope.mousedown$0);
	scope.if$0 = unmountBlock(scope.if$0);
	scope.inj$0 = null;
}