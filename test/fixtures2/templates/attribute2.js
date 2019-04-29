import { createInjector, setAttribute, elem, addClass, finalizeAttributes, addDisposeCallback } from "@endorphinjs/endorphin";

function ifAttr$0(host, injector) {
	if (host.props.c1) {
		setAttribute(injector, "a2", "1");
	}
	return 0;
}

function ifAttr$1(host, injector) {
	if (host.props.c2) {
		addClass(injector, "foo bar");
	}
	return 0;
}

function ifAttr$2(host, injector) {
	if (host.props.c3) {
		setAttribute(injector, "class", ("bam" + host.props.id));
	}
	return 0;
}

export default function template$0(host, scope) {
	const target$0 = host.componentView;
	const main$0 = target$0.appendChild(elem("main"));
	const inj$0 = scope.inj$0 = createInjector(main$0);
	setAttribute(inj$0, "a1", host.props.id);
	setAttribute(inj$0, "a2", "0");
	setAttribute(inj$0, "class", "foo");
	ifAttr$0(host, inj$0);
	ifAttr$1(host, inj$0);
	ifAttr$2(host, inj$0);
	addClass(inj$0, "baz");
	finalizeAttributes(inj$0);
	addDisposeCallback(host, template$0Unmount);
	return template$0Update;
}

function template$0Update(host, scope) {
	const { inj$0 } = scope;
	setAttribute(inj$0, "a1", host.props.id);
	setAttribute(inj$0, "a2", "0");
	setAttribute(inj$0, "class", "foo");
	ifAttr$0(host, inj$0);
	ifAttr$1(host, inj$0);
	ifAttr$2(host, inj$0);
	addClass(inj$0, "baz");
	finalizeAttributes(inj$0);
}

function template$0Unmount(scope) {
	scope.inj$0 = null;
}