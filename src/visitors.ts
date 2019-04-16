import * as Ast from '@endorphinjs/template-parser';
import { SourceNode } from 'source-map';
import CompileState from "./compile-state";
import { sn } from './utils';

type AstContinue = (node: Ast.Node) => SourceNode;
type AstVisitor = (node: Ast.Node, state: CompileState, next: AstContinue) => SourceNode | void;
type AstVisitorMap = { [name: string]: AstVisitor };

const baseVisitors = {
    ENDTemplate(node: Ast.ENDTemplate, state, next) {
        const name = state.block('template', () => node.body.forEach(next));
        state.pushOutput(`export default ${name};`);
    }
} as AstVisitorMap;
