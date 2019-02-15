import { elemWithText } from "@endorphinjs/endorphin";

export const cssScope = "scope123";

export default function $$template0(host) {
	const target0 = host.componentView;
	target0.appendChild(elemWithText("h1", "Hello world", cssScope));
}