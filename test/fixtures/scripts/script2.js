import { elemWithText } from "@endorphinjs/endorphin";
export * from "./script.js";

export default function template$0(host) {
	const target$0 = host.componentView;
	target$0.appendChild(elemWithText("h1", "Hello world"));
}