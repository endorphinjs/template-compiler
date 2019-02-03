import { elemWithText } from "@endorphinjs/endorphin";

export default function $$template0(host) {
	const target0 = host.componentView;
	target0.appendChild(elemWithText("h1", "Hello world", host));
}


export function willRender(component) {
	console.log('rendered', component.nodeName);
}