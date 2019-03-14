import { elemWithText, elemNS, setAttributeNS, finalizeAttributes, createInjector, addDisposeCallback } from "@endorphinjs/endorphin";
const $$ns0 = "http://www.w3.org/2000/svg";
const $$ns1 = "http://www.w3.org/1999/xlink";

export default function $$template0(host, scope) {
	const target0 = host.componentView;
	target0.appendChild(elemWithText("header", "Header"));
	const svg0 = target0.appendChild(elemNS("svg", $$ns0));
	svg0.setAttribute("width", "16");
	svg0.setAttribute("height", "16");
	svg0.setAttribute("viewBox", "0 0 16 16");
	svg0.setAttribute("version", "1.1");
	svg0.setAttribute("xmlns", "http://www.w3.org/2000/svg");
	svg0.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
	const path0 = svg0.appendChild(elemNS("path", $$ns0));
	path0.setAttribute("class", "svg-fill");
	path0.setAttribute("d", "M8 11.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5.67-1.5 1.5-1.5zm0-5c.83 0 1.5.67 1.5 1.5S8.83 9.5 8 9.5 6.5 8.83 6.5 8 7.17 6.5 8 6.5zm0-5c.83 0 1.5.67 1.5 1.5S8.83 4.5 8 4.5 6.5 3.83 6.5 3 7.17 1.5 8 1.5z");
	const image0 = svg0.appendChild(elemNS("image", $$ns0));
	const injector0 = scope.$_injector0 = createInjector(image0);
	setAttributeNS(injector0, $$ns1, "href", host.state.url);
	image0.setAttribute("height", "100px");
	image0.setAttribute("width", "100px");
	finalizeAttributes(injector0);
	target0.appendChild(elemWithText("footer", "Footer"));
	addDisposeCallback(host, $$template0Unmount);
	return $$template0Update;
}

function $$template0Update(host, scope) {
	const injector0 = scope.$_injector0;
	setAttributeNS(injector0, $$ns1, "href", host.state.url);
	finalizeAttributes(injector0);
}

function $$template0Unmount(scope) {
	scope.$_injector0 = null;
}