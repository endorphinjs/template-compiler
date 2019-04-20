import { ENDProgram } from '@endorphinjs/template-parser';
import { SourceNode } from 'source-map';
import CompileState from "./compile-state";
import { sn, qStr, format } from './utils';
import { CompileStateOptions, ChunkList } from './types';
import { ENDCompileError } from './error';
import templateVisitors, { AstContinue, AstVisitorMap } from './template-visitors';

export default function generateTemplate(ast: ENDProgram, options?: CompileStateOptions): SourceNode {
    const state = new CompileState(options);
    const body: ChunkList = [];

    // Collect child components. We should do it in separate pass to hoist component
    // definitions before templates are rendered
    registerComponents(ast, state);

    // Compile template to collect usage stats as well
    const template = compileTemplate(ast, state, templateVisitors);

    // Import runtime symbols, used by template
    if (state.usedRuntime.size) {
        body.push(`import { ${Array.from(state.usedRuntime).join(', ')} } from "${state.options.module}";`);
    }

    // Import helpers
    state.getUsedHelpers().forEach((helpers, url) => {
        body.push(`import { ${helpers.join(', ')} } from ${qStr(url)};`);
    });

    // Import child components
    state.componentsMap.forEach((item, name) => {
        if (item.used) {
            body.push(`import * as ${item.symbol} from ${qStr(item.href)};`);
        } else {
            state.warn(`Unused import "${name}", skipping`, item.node.loc.start.offset);
        }
    });

    // CSS scoping
    if (state.options.cssScope) {
        body.push(`export const cssScope = ${qStr(state.options.cssScope)};`);
    }

    // Used namespaces
    state.namespaceSymbols.forEach((symbol, uri) => {
        body.push(`const ${symbol} = ${qStr(uri)};`);
    });

    // Output scripts
    ast.scripts.forEach(script => {
        if (script.url) {
            body.push(sn(`export * from ${qStr(script.url)};`));
        } else if (script.transformed || script.content) {
            body.push(sn(script.transformed || script.content));
        }
    });

    body.push('', template);

    return sn(format(body));
}

function compileTemplate(ast: ENDProgram, state: CompileState, visitors: AstVisitorMap) {
    const next: AstContinue = node => {
        if (node.type in visitors) {
            return visitors[node.type](node, state, next);
        }
        throw new ENDCompileError(`${node.type} is not supported in templates`, node);
    };

    ast.body.forEach(node => {
        if (node.type === 'ENDTemplate' || node.type === 'ENDPartial') {
            next(node);
        }
    });

    return state.output;
}

function registerComponents(ast: ENDProgram, state: CompileState) {
    ast.body.forEach(node => {
        if (node.type === 'ENDImport') {
            state.registerComponent(node);
        }
    });
}
