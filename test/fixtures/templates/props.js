import { createComponent, setAttribute, mountComponent, updateComponent, unmountComponent, addDisposeCallback, markSlotUpdate } from "@endorphinjs/endorphin";
import * as SubComponent from "./sub-component.html";

export default function $$template0(host, scope) {
	const target0 = host.componentView;
	const subComponent0 = scope.$_subComponent0 = target0.appendChild(createComponent("sub-component", SubComponent, host));
	const injector0 = scope.$_injector0 = subComponent0.componentModel.input;
	setAttribute(injector0, "id", host.props.id);
	$$ifAttr0(host, injector0);
	setAttribute(injector0, "p3", "3");
	mountComponent(subComponent0, {
		p1: "1"
	});
	addDisposeCallback(host, $$template0Unmount);
	return $$template0Update;
}

function $$template0Update(host, scope) {
	const injector0 = scope.$_injector0;
	let s__subComponent0 = 0;
	s__subComponent0 |= setAttribute(injector0, "id", host.props.id);
	s__subComponent0 |= $$ifAttr0(host, injector0);
	s__subComponent0 |= setAttribute(injector0, "p3", "3");
	markSlotUpdate(scope.$_subComponent0, "", s__subComponent0);
	updateComponent(scope.$_subComponent0);
	return s__subComponent0;
}

function $$template0Unmount(scope) {
	scope.$_subComponent0 = unmountComponent(scope.$_subComponent0);
	scope.$_injector0 = null;
}

function $$ifAttr0(host, injector) {
	if (host.props.c1) {
		setAttribute(injector, "p2", "2");
	}
	return 0;
}