import { elemWithText, insert, elem, updateBlock, mountBlock, text, createInjector } from "@endorphinjs/endorphin";

export default function $$template0(host, scope) {
	const target0 = host.componentView;
	const injector0 = createInjector(target0);
	insert(injector0, elemWithText("h1", "Hello world", host));
	scope.$_block2 = mountBlock(host, injector0, $$conditionEntry0);
	const blockquote0 = insert(injector0, elem("blockquote", host));
	const injector1 = createInjector(blockquote0);
	insert(injector1, elemWithText("p", "Lorem ipsum 1", host));
	scope.$_block3 = mountBlock(host, injector1, $$conditionEntry3);
	insert(injector1, elemWithText("p", "Lorem ipsum 2", host));
	return $$template0Update;
}

function $$template0Update(host, scope) {
	updateBlock(scope.$_block2);
	updateBlock(scope.$_block3);
}

function $$conditionContent1(host, injector) {
	insert(injector, elemWithText("div", "top 2", host));
}

function $$conditionEntry1(host) {
	if (host.props.expr2) {
		return $$conditionContent1;
	} 
}

function $$conditionContent2(host, injector) {
	insert(injector, elemWithText("div", "top 3", host));
	insert(injector, text("\n            top 3.1\n        "));
}

function $$conditionEntry2(host) {
	if (host.props.expr3) {
		return $$conditionContent2;
	} 
}

function $$conditionContent0(host, injector, scope) {
	const p0 = insert(injector, elem("p", host));
	p0.appendChild(elemWithText("strong", "top 1", host));
	scope.$_block0 = mountBlock(host, injector, $$conditionEntry1);
	scope.$_block1 = mountBlock(host, injector, $$conditionEntry2);
	return $$conditionContent0Update;
}

function $$conditionContent0Update(host, injector, scope) {
	updateBlock(scope.$_block0);
	updateBlock(scope.$_block1);
}

function $$conditionEntry0(host) {
	if (host.props.expr1) {
		return $$conditionContent0;
	} 
}

function $$conditionContent3(host, injector) {
	insert(injector, elemWithText("div", "sub 1", host));
}

function $$conditionContent4(host, injector) {
	insert(injector, elemWithText("div", "sub 2", host));
}

function $$conditionContent5(host, injector) {
	insert(injector, elemWithText("div", "sub 3", host));
}

function $$conditionEntry3(host) {
	if ((host.props.expr1 === 1)) {
		return $$conditionContent3;
	} else if ((host.props.expr1 === 2)) {
		return $$conditionContent4;
	} else {
		return $$conditionContent5;
	} 
}