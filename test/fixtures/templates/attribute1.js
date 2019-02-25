import { elem, setAttribute, finalizeAttributes, createInjector } from "@endorphinjs/endorphin";

export default function $$template0(host, scope) {
	const target0 = host.componentView;
	const main0 = target0.appendChild(elem("main"));
	const injector0 = scope.$_injector0 = createInjector(main0);
	setAttribute(injector0, "a1", host.props.id);
	setAttribute(injector0, "a2", "0");
	$$ifAttr0(host, injector0);
	$$ifAttr1(host, injector0);
	$$ifAttr2(host, injector0);
	setAttribute(injector0, "a3", "4");
	finalizeAttributes(injector0);
	return $$template0Update;
}

function $$template0Update(host, scope) {
	const injector0 = scope.$_injector0;
	setAttribute(injector0, "a1", host.props.id);
	setAttribute(injector0, "a2", "0");
	$$ifAttr0(host, injector0);
	$$ifAttr1(host, injector0);
	$$ifAttr2(host, injector0);
	setAttribute(injector0, "a3", "4");
	finalizeAttributes(injector0);
}

function $$ifAttr0(host, injector) {
	if (host.props.c1) {
		setAttribute(injector, "a2", "1");
	}
	return 0;
}

function $$ifAttr1(host, injector) {
	if (host.props.c2) {
		setAttribute(injector, "a2", "2");
	}
	return 0;
}

function $$ifAttr2(host, injector) {
	if (host.props.c3) {
		setAttribute(injector, "a2", "3");setAttribute(injector, "a1", "3");setAttribute(injector, "a3", "3");
	}
	return 0;
}