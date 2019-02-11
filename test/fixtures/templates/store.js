import { elem, text, updateText, subscribeStore } from "@endorphinjs/endorphin";

export default function $$template0(host, scope) {
	const target0 = host.componentView;
	const div0 = target0.appendChild(elem("div", host));
	const p0 = div0.appendChild(elem("p", host));
	p0.appendChild(text("Store value is "));
	scope.$_text0 = p0.appendChild(text(scope.$_textValue0 = host.store.data.foo));
	subscribeStore(host, ["foo"]);
	return $$template0Update;
}

function $$template0Update(host, scope) {
	scope.$_textValue0 = updateText(scope.$_text0, host.store.data.foo, scope.$_textValue0);
}