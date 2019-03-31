import { elem, setAttribute, text, updateText, finalizeAttributes, createInjector, addDisposeCallback } from "@endorphinjs/endorphin";

export default function $$template0(host, scope) {
	const target0 = host.componentView;
	scope.v1 = "bar";scope.v2 = (1 + 2);scope.v3 = "foo " + host.props.v1;
	const div0 = target0.appendChild(elem("div"));
	const injector0 = scope.$_injector0 = createInjector(div0);
	setAttribute(injector0, "class", scope.v1);
	setAttribute(injector0, "title", host.props.v3);
	div0.appendChild(text("Sum: "));
	scope.$_text0 = div0.appendChild(text(scope.v2));
	finalizeAttributes(injector0);
	addDisposeCallback(host, $$template0Unmount);
	return $$template0Update;
}

function $$template0Update(host, scope) {
	const injector0 = scope.$_injector0;
	scope.v1 = "bar";
	scope.v2 = (1 + 2);
	scope.v3 = "foo " + host.props.v1;
	setAttribute(injector0, "class", scope.v1);
	setAttribute(injector0, "title", host.props.v3);
	updateText(scope.$_text0, scope.v2);
	finalizeAttributes(injector0);
}

function $$template0Unmount(scope) {
	scope.$_text0 = null;
	scope.$_injector0 = null;
}
