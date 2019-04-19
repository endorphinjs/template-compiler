import ElementContext from "./element-context";
import { usageStats } from "./utils";

export default class BlockContext {
    /** Context of element output */
    element?: ElementContext;

    scopeUsage = usageStats();

    /**
     * @param name Name of the block, will be used as suffix in generated function
     * so it must be unique in its scope
     */
    constructor(readonly name: string) {}
}
