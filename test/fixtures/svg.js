import { elemWithText, elemNS } from "@endorphinjs/endorphin";
const $$ns0 = "http://www.w3.org/2000/svg";

export default function $$template0(host) {
	const target0 = host.componentView;
	target0.appendChild(elemWithText("header", "Header"));
	const svg0 = target0.appendChild(elemNS("svg", $$ns0));
	svg0.setAttribute("width", "16");
	svg0.setAttribute("height", "16");
	svg0.setAttribute("viewBox", "0 0 16 16");
	svg0.setAttribute("version", "1.1");
	svg0.setAttribute("xmlns", "http://www.w3.org/2000/svg");
	const path0 = svg0.appendChild(elemNS("path", $$ns0));
	path0.setAttribute("class", "svg-fill");
	path0.setAttribute("d", "M8 11.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5.67-1.5 1.5-1.5zm0-5c.83 0 1.5.67 1.5 1.5S8.83 9.5 8 9.5 6.5 8.83 6.5 8 7.17 6.5 8 6.5zm0-5c.83 0 1.5.67 1.5 1.5S8.83 4.5 8 4.5 6.5 3.83 6.5 3 7.17 1.5 8 1.5z");
	target0.appendChild(elemWithText("footer", "Footer"));
}