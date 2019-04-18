import Entity from "./entity";
import ElementContext from "./element-context";
import { RenderContext } from "./types";

export default class BlockContext {
    /** List of entities used in current block */
    entities: Entity[] = [];

    /** Context of element output */
    element?: ElementContext;

    context: RenderContext = 'mount';

    /**
     * @param name Name of the block, will be used as suffix in generated function
     * so it must be unique in its scope
     */
    constructor(readonly name: string) {}

    /**
     * Adds given entity to list
     */
    push(entity: Entity) {
        if (this.element) {
            this.element.entities.push(entity);
        } else {
            this.entities.push(entity);
        }
    }
}
