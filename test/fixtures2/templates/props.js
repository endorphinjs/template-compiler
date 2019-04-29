import { setAttribute, createComponent, markSlotUpdate, mountComponent, updateComponent, unmountComponent, addDisposeCallback } from "@endorphinjs/endorphin";
import * as SubComponent from "./sub-component.html";

function ifAttr$0(host, injector) {
	if (host.props.c1) {
		setAttribute(injector, "p2", "2");
	}
	return 0;
}

export default function template$0(host, scope) {
	const target$0 = host.componentView;
	const subComponent$0 = scope.subComponent$0 = target$0.appendChild(createComponent("sub-component", SubComponent, host));
	const inj$0 = scope.inj$0 = subComponent$0.componentModel.input;
	setAttribute(inj$0, "id", host.props.id);
	ifAttr$0(host, inj$0);
	setAttribute(inj$0, "p3", 3);
	mountComponent(subComponent$0, {
		p1: "1"
	});
	addDisposeCallback(host, template$0Unmount);
	return template$0Update;
}

function template$0Update(host, scope) {
	let su$0 = 0;
	const { subComponent$0, inj$0 } = scope;
	su$0 |= setAttribute(inj$0, "id", host.props.id);
	su$0 |= ifAttr$0(host, inj$0);
	su$0 |= setAttribute(inj$0, "p3", 3);
	markSlotUpdate(subComponent$0, "", su$0);
	updateComponent(subComponent$0);
	return su$0;
}

function template$0Unmount(scope) {
	unmountComponent(scope.subComponent$0);
	scope.inj$0 = scope.subComponent$0 = null;
}