import { elem, createInjector, setAttribute, addClass, mountBlock, updateBlock, unmountBlock, finalizeAttributes, addDisposeCallback } from "@endorphinjs/endorphin";

function ifAttr$0(host, injector, scope) {
	if (((host.state.customBg && (host.state.customBg !== "default")) && !scope["pro-mode"])) {
		addClass(injector, "__bg __" + host.state.customBg);
	}
	return 0;
}

function ifBody$0(host, injector) {
	setAttribute(injector, "style", host.state.css);
	ifAttr$0(host, injector);
	return ifBody$0Update;
}

function ifBody$0Update(host, scope) {
	ifAttr$0(host, scope.injector);
}

function ifEntry$0(host) {
	if ((host.state.foo === "bar")) {
		return ifBody$0;
	}
}

export default function template$0(host, scope) {
	const target$0 = host.componentView;
	const main$0 = target$0.appendChild(elem("main"));
	const inj$0 = scope.inj$0 = createInjector(main$0);
	scope.if$0 = mountBlock(host, inj$0, ifEntry$0);
	finalizeAttributes(inj$0);
	addDisposeCallback(host, template$0Unmount);
	return template$0Update;
}

function template$0Update(host, scope) {
	updateBlock(scope.if$0);
	finalizeAttributes(scope.inj$0);
}

function template$0Unmount(scope) {
	scope.if$0 = unmountBlock(scope.if$0);
	scope.inj$0 = null;
}