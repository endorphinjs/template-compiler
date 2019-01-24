import { elem, setAttribute, addClass, finalizeAttributes, createInjector } from "@endorphinjs/endorphin";

export default function $$template0(host, scope) {
	const target0 = host.componentView;
	const main0 = target0.appendChild(elem("main", host));
	const injector0 = scope.$_injector0 = createInjector(main0);
	setAttribute(injector0, "a1", host.props.id);
	setAttribute(injector0, "a2", "0");
	setAttribute(injector0, "class", "foo");
	$$ifAttr0(host, injector0);
	$$ifAttr1(host, injector0);
	$$ifAttr2(host, injector0);
	addClass(scope.$_injector0, "baz");
	finalizeAttributes(injector0);
	return $$template0Update;
}

function $$template0Update(host, scope) {
	const injector0 = scope.$_injector0;
	setAttribute(injector0, "a1", host.props.id);
	setAttribute(injector0, "a2", "0");
	setAttribute(injector0, "class", "foo");
	$$ifAttr0(host, injector0);
	$$ifAttr1(host, injector0);
	$$ifAttr2(host, injector0);
	addClass(scope.$_injector0, "baz");
	finalizeAttributes(injector0);
}

function $$ifAttr0(host, injector) {
	if (host.props.c1) {
		setAttribute(injector, "a2", "1");
	}
}

function $$ifAttr1(host, injector) {
	if (host.props.c2) {
		addClass(injector, "foo bar");
	}
}

function $$ifAttr2(host, injector) {
	if (host.props.c3) {
		setAttribute(injector, "class", ("bam" + host.props.id));
	}
}