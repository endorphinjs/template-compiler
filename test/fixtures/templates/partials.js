import { elem, mountPartial, updatePartial, unmountPartial, addDisposeCallback, mountIterator, updateIterator, unmountIterator, finalizeAttributes, finalizeEvents, createInjector, finalizeRefs, insert, addClass, text, updateText } from "@endorphinjs/endorphin";

export const partials = {
	button: {
		body: $$partialButton0,
		defaults: {
			item: true,
			enabled: true,
			pos: 0
		}
	}
};

function $$partialButton0(host, injector, scope) {
	const li0 = insert(injector, elem("li"));
	const injector0 = scope.$_injector1 = createInjector(li0);
	$$ifAttr0(host, injector0, scope);
	scope.$_text0 = insert(injector0, text(scope.item));
	finalizeAttributes(injector0);
	addDisposeCallback(injector, $$partialButton0Unmount);
	return $$partialButton0Update;
}

function $$partialButton0Update(host, injector, scope) {
	const injector0 = scope.$_injector1;
	$$ifAttr0(host, injector0, scope);
	updateText(scope.$_text0, scope.item);
	finalizeAttributes(injector0);
}

function $$partialButton0Unmount(scope) {
	scope.$_text0 = null;
	scope.$_injector1 = null;
}

export default function $$template0(host, scope) {
	const target0 = host.componentView;
	const ul0 = target0.appendChild(elem("ul"));
	const injector0 = scope.$_injector0 = createInjector(ul0);
	scope.$_iter0 = mountIterator(host, injector0, $$iteratorExpr0, $$iteratorBlock0);
	finalizeAttributes(injector0);
	finalizeEvents(injector0);
	finalizeRefs(host);
	addDisposeCallback(host, $$template0Unmount);
	return $$template0Update;
}

function $$template0Update(host, scope) {
	const injector0 = scope.$_injector0;
	updateIterator(scope.$_iter0);
	finalizeAttributes(injector0);
	finalizeEvents(injector0);
	finalizeRefs(host);
}

function $$template0Unmount(scope) {
	scope.$_iter0 = unmountIterator(scope.$_iter0);
	scope.$_injector0 = null;
}

function $$iteratorExpr0(host) {
	return host.props.items;
}

function $$iteratorBlock0(host, injector, scope) {
	scope.$_partial0 = mountPartial(host, injector, host.props['partial:button'] || partials.button, {
		item: scope.item,
		enabled: (scope.index !== 1)
	});
	addDisposeCallback(injector, $$iteratorBlock0Unmount);
	return $$iteratorBlock0Update;
}

function $$iteratorBlock0Update(host, injector, scope) {
	updatePartial(scope.$_partial0, host.props['partial:button'] || partials.button, {
		item: scope.item,
		enabled: (scope.index !== 1)
	});
}

function $$iteratorBlock0Unmount(scope) {
	scope.$_partial0 = unmountPartial(scope.$_partial0);
}

function $$ifAttr0(host, injector, scope) {
	if (scope.enabled) {
		addClass(injector, "enabled");
	}
	return 0;
}