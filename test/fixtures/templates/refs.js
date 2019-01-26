import { elem, setRef, insert, updateBlock, mountBlock, createInjector, finalizeRefs } from "@endorphinjs/endorphin";

export default function $$template0(host, scope) {
	const target0 = host.componentView;
	const main0 = scope.$_main0 = target0.appendChild(elem("main", host));
	const injector0 = createInjector(main0);
	setRef(host, "main", main0);
	const div0 = scope.$_div0 = insert(injector0, elem("div", host));
	setRef(host, "header", div0);
	scope.$_block0 = mountBlock(host, injector0, $$conditionEntry0);
	const footer0 = scope.$_footer0 = insert(injector0, elem("footer", host));
	setRef(host, host.props.dynRef, footer0);
	finalizeRefs(host);
	return $$template0Update;
}

function $$template0Update(host, scope) {
	setRef(host, "main", scope.$_main0);
	setRef(host, "header", scope.$_div0);
	updateBlock(scope.$_block0);
	setRef(host, host.props.dynRef, scope.$_footer0);
	finalizeRefs(host);
}

function $$conditionContent0(host, injector, scope) {
	const span0 = scope.$_span0 = insert(injector, elem("span", host));
	setRef(host, "header", span0);
	return $$conditionContent0Update;
}

function $$conditionContent0Update(host, injector, scope) {
	setRef(host, "header", scope.$_span0);
}

function $$conditionEntry0(host) {
	if (host.props.c1) {
		return $$conditionContent0;
	} 
}