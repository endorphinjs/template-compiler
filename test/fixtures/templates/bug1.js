import { elem, setAttribute, addClass, mountBlock, updateBlock, unmountBlock, finalizeAttributes, createInjector, addDisposeCallback } from "@endorphinjs/endorphin";

export default function $$template0(host, scope) {
	const target0 = host.componentView;
	const main0 = target0.appendChild(elem("main"));
	const injector0 = scope.$_injector0 = createInjector(main0);
	scope.$_block0 = mountBlock(host, injector0, $$conditionEntry0);
	finalizeAttributes(injector0);
	addDisposeCallback(host, $$template0Unmount);
	return $$template0Update;
}

function $$template0Update(host, scope) {
	const injector0 = scope.$_injector0;
	updateBlock(scope.$_block0);
	finalizeAttributes(injector0);
}

function $$template0Unmount(scope) {
	scope.$_block0 = unmountBlock(scope.$_block0);
	scope.$_injector0 = null;
}

function $$class0(host) {
	return "__bg __" + (host.state.customBg);
}

function $$ifAttr0(host, injector, scope) {
	if (((host.state.customBg && (host.state.customBg !== "default")) && !scope["pro-mode"])) {
		addClass(injector, $$class0(host, scope));
	}
	return 0;
}

function $$conditionContent0(host, injector, scope) {
	setAttribute(injector, "style", host.state.css);
	$$ifAttr0(host, injector, scope);
	return $$conditionContent0Update;
}

function $$conditionContent0Update(host, injector, scope) {
	const injector0 = injector;
	setAttribute(injector0, "style", host.state.css);
	$$ifAttr0(host, injector0, scope);
}

function $$conditionEntry0(host) {
	if ((host.state.foo === "bar")) {
		return $$conditionContent0;
	} 
}