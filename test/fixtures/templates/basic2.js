import { elemWithText, elem, text, updateText, addDisposeCallback } from "@endorphinjs/endorphin";

export default function $$template0(host, scope) {
	const target0 = host.componentView;
	target0.appendChild(elemWithText("h1", "Hello world"));
	const p0 = target0.appendChild(elem("p"));
	p0.setAttribute("title", "test");
	p0.appendChild(text("foo "));
	scope.$_text0 = p0.appendChild(text(host.props.bar));
	p0.appendChild(text(" baz"));
	addDisposeCallback(host, $$template0Unmount);
	return $$template0Update;
}

function $$template0Update(host, scope) {
	updateText(scope.$_text0, host.props.bar);
}

function $$template0Unmount(scope) {
	scope.$_text0 = null;
}