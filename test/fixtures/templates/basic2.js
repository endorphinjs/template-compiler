import { elemWithText, elem, text, updateText } from "@endorphinjs/endorphin";

export default function $$template0(host, scope) {
	const target0 = host.componentView;
	target0.appendChild(elemWithText("h1", "Hello world", host));
	const p0 = target0.appendChild(elem("p", host));
	p0.setAttribute("title", "test");
	p0.appendChild(text("foo "));
	scope.$_text0 = p0.appendChild(text(scope.$_textValue0 = host.props.bar));
	p0.appendChild(text(" baz"));
	return $$template0Update;
}

function $$template0Update(host, scope) {
	scope.$_textValue0 = updateText(scope.$_text0, host.props.bar, scope.$_textValue0);
}
