import Entity, { entity } from "./Entity";
import { ENDVariableStatement, ENDVariable } from "@endorphinjs/template-parser";
import CompileState from "./CompileState";
import { isPropKey, qStr, sn } from "../utils";
import { compileAttributeValue } from "./AttributeEntity";

export default class VariableEntity extends Entity {
    constructor(node: ENDVariableStatement, readonly state: CompileState) {
        super('vars', state);
        const fn = state.runBlock('setVars', () => {
            return node.variables.map(v => entity(v.name, state, {
                mount() {
                    return sn([`${varAccess(v, state)} = `, compileAttributeValue(v.value, state)]);
                }
            }));
        });
        this.setShared(() => `${fn}(${state.host}, ${state.scope})`);
    }
}

function varAccess(v: ENDVariable, state: CompileState): string {
    return `${state.scope}${isPropKey(v.name) ? `.${v.name}` : `[${qStr(v.name)}]`}`;
}
