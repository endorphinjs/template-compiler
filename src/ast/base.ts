export interface SourceLocation {
    source?: string | null;
    start: Position;
    end: Position;
}

export interface Position {
    line: number; // >= 1
    column: number; // >= 0
    pos: number; // >= 0
}

export class Node {
    type: string;
    loc?: SourceLocation;
}
