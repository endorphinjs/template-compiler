import { SourceNode } from "source-map";
import { AstWalkerContinuation } from "@endorphinjs/template-parser";
import CompileState from "./compile-state";

export type Chunk = string | SourceNode;
export type ChunkList = Chunk[];
export type AstContinue = AstWalkerContinuation<CompileState>
export type RenderContext = 'mount' | 'update' | 'unmount';
export type EntityType = 'element' | 'attribute' | 'text' | 'block';
export type UsageStats = { [K in RenderContext]: number };
