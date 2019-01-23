import { elemWithText, insert, createInjector, elem, text, updateText, updateBlock, mountBlock } from "@endorphinjs/endorphin";

export default function $$mount0(host) {
	const target = host.componentView;
	const injector0 = createInjector(target);
	insert(injector0, elemWithText("h1", "Hello world", host));
	const block0 = mountBlock(host, injector0, $$conditionBlock0);
	return function $$update0() {
		updateBlock(block0);
	};
}

function $$conditionContent0(host, injector) {
	const div0 = insert(injector, elem("div", host));
	div0.setAttribute("class", "sample");
	div0.appendChild(text("Foo is "));
	let textValue0 = host.props.foo;
	const text0 = div0.appendChild(text(host.props.foo));
	return function update_$$conditionContent0() {
		textValue0 = updateText(text0, host.props.foo, textValue0);
	};
}

function $$conditionBlock0(host) {
	if ((host.props.foo == 1)) {
		return $$conditionContent0;
	} 
}