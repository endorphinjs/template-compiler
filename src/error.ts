import { Node } from "@endorphinjs/template-parser";

export class ENDCompileError extends Error {
    constructor(message: string, readonly node: Node) {
        super(message);
    }
}
