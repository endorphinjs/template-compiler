import { elem, updatePartial, mountPartial, updateIterator, mountIterator, createInjector, insert, addClass, text, updateText, finalizeAttributes } from "@endorphinjs/endorphin";

export const partials = {
	button: {
		body: $$partialButton0,
		defaults: {
			item: null,
			enabled: true,
			pos: 0
		}
	}
};

function $$partialButton0(host, injector, scope) {
	const li0 = insert(injector, elem("li", host));
	const injector0 = scope.$_injector0 = createInjector(li0);
	$$ifAttr0(host, injector0, scope);
	scope.$_text0 = insert(injector0, text(scope.$_textValue0 = scope.item));
	finalizeAttributes(injector0);
	return $$partialButton0Update;
}

function $$partialButton0Update(host, injector, scope) {
	const injector0 = scope.$_injector0;
	$$ifAttr0(host, injector0, scope);
	scope.$_textValue0 = updateText(scope.$_text0, scope.item, scope.$_textValue0);
	finalizeAttributes(injector0);
}

export default function $$template0(host, scope) {
	const target0 = host.componentView;
	const ul0 = target0.appendChild(elem("ul", host));
	const injector0 = createInjector(ul0);
	scope.$_iter0 = mountIterator(host, injector0, $$iteratorExpr0, $$iteratorBlock0);
	return $$template0Update;
}

function $$template0Update(host, scope) {
	updateIterator(scope.$_iter0);
}

function $$iteratorExpr0(host) {
	return host.props.items;
}

function $$iteratorBlock0(host, injector, scope) {
	scope.$_partial0 = mountPartial(host, injector, host.props['partial:button'] || partials.button, {
		item: scope.item,
		enabled: (scope.index !== 1)
	});
	return $$iteratorBlock0Update;
}

function $$iteratorBlock0Update(host, injector, scope) {
	updatePartial(scope.$_partial0, host.props['partial:button'] || partials.button, {
		item: scope.item,
		enabled: (scope.index !== 1)
	});
}

function $$ifAttr0(host, injector, scope) {
	if (scope.enabled) {
		addClass(injector, "enabled");
	}
}