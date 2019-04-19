import { elemWithText, text, updateText } from "@endorphinjs/endorphin";

function template$$0(host, scope) {
	const target$$0 = host.componentView;
	target$$0.appendChild(elemWithText("h1", "Hello world"));
	p$$0.setAttribute("title", "test");
	p$$0.appendChild(text("foo "));
	scope.text$$1 = p$$0.appendChild(text(host.props.bar));
	p$$0.appendChild(text(" baz"));
	return template$$0Update;
}

function template$$0Update(host) {
	p$$0.setAttribute("title", "test");
	updateText(text$$1, host.props.bar);
}

function template$$0Unmount(scope) {
	scope.titleAttr$$0 = scope.text$$1 = null
}
export default template$$0;