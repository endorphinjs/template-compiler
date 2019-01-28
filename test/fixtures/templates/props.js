import { createComponent, setAttribute, mountComponent, updateComponent } from "@endorphinjs/endorphin";
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
	setAttribute(injector0, "id", host.props.id);
	$$ifAttr0(host, injector0);
	setAttribute(injector0, "p3", "3");
	updateComponent(scope.$_subComponent0);
}

function $$ifAttr0(host, injector) {
	if (host.props.c1) {
		setAttribute(injector, "p2", "2");
	}
}