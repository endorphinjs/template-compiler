import { createComponent, setAttribute, mountComponent, updateComponent, markSlotUpdate } from "@endorphinjs/endorphin";
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
	return $$template0Update;
}

function $$template0Update(host, scope) {
	const injector0 = scope.$_injector0;
	let updated = 0;
	updated |= setAttribute(injector0, "id", host.props.id);
	updated |= $$ifAttr0(host, injector0);
	updated |= setAttribute(injector0, "p3", "3");
	markSlotUpdate(scope.$_subComponent0, "", updated);
	updateComponent(scope.$_subComponent0);
	return updated;
}

function $$ifAttr0(host, injector) {
	if (host.props.c1) {
		setAttribute(injector, "p2", "2");
	}
	return 0;
}