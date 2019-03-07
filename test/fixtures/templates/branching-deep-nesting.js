import { insert, text, mountBlock, updateBlock, unmountBlock, addDisposeCallback, createInjector } from "@endorphinjs/endorphin";

export default function $$template0(host, scope) {
	const target0 = host.componentView;
	const injector0 = createInjector(target0);
	scope.$_block2 = mountBlock(host, injector0, $$conditionEntry0);
	addDisposeCallback(host, $$template0Unmount);
	return $$template0Update;
}

function $$template0Update(host, scope) {
	updateBlock(scope.$_block2);
}

function $$template0Unmount(scope) {
	scope.$_block2 = unmountBlock(scope.$_block2);
}

function $$conditionContent2(host, injector) {
	insert(injector, text("\n                test\n            "));
}

function $$conditionEntry2(host) {
	if (host.props.expr3) {
		return $$conditionContent2;
	} 
}

function $$conditionContent1(host, injector, scope) {
	scope.$_block0 = mountBlock(host, injector, $$conditionEntry2);
	addDisposeCallback(injector, $$conditionContent1Unmount);
	return $$conditionContent1Update;
}

function $$conditionContent1Update(host, injector, scope) {
	updateBlock(scope.$_block0);
}

function $$conditionContent1Unmount(scope) {
	scope.$_block0 = unmountBlock(scope.$_block0);
}

function $$conditionEntry1(host) {
	if (host.props.expr2) {
		return $$conditionContent1;
	} 
}

function $$conditionContent0(host, injector, scope) {
	scope.$_block1 = mountBlock(host, injector, $$conditionEntry1);
	addDisposeCallback(injector, $$conditionContent0Unmount);
	return $$conditionContent0Update;
}

function $$conditionContent0Update(host, injector, scope) {
	updateBlock(scope.$_block1);
}

function $$conditionContent0Unmount(scope) {
	scope.$_block1 = unmountBlock(scope.$_block1);
}

function $$conditionEntry0(host) {
	if (host.props.expr1) {
		return $$conditionContent0;
	} 
}