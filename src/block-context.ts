import { SourceNode } from "source-map";
import Entity from "./entity";
import ElementContext from "./element-context";

export default class BlockContext {
    /** List of entities used in current block */
    entities: Entity[] = [];

    /** Output source node of generated code */
    output = new SourceNode();

    /** Context of element output */
    element?: ElementContext;

    /** Pointer to parent block context */
    parent?: BlockContext;

    /**
     * @param name Name of the block, will be used as suffix in generated function
     * so it must be unique in its scope
     */
    constructor(readonly name: string) {}

    /**
     * Adds given entity to list
     */
    push(entity: Entity) {
        this.entities.push(entity);
    }

    /**
     * Generates JS code for accumulated context data
     */
    generate(): SourceNode {
        // TODO implement
        return this.output;
    }
}
