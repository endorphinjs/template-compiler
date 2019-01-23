import { elemWithText, elem, text, updateText } from "@endorphinjs/endorphin";

export default function $$template0(host, scope) {
	scope.$_target0 = host.componentView;
	scope.$_target0.appendChild(elemWithText("h1", "Hello world", host));
	scope.$_p0 = scope.$_target0.appendChild(elem("p", host));
	scope.$_p0.setAttribute("title", "test");
	scope.$_p0.appendChild(text("foo "));
	scope.$_text0 = scope.$_p0.appendChild(text(scope.$_textValue0 = host.props.bar));
	scope.$_p0.appendChild(text(" baz"));
	return $$template0Update;
}

function $$template0Update(host, scope) {
	scope.$_textValue0 = updateText(scope.$_text0, host.props.bar, scope.$_textValue0);
}
