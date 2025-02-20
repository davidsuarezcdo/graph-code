import ts from 'typescript';
import { DecoratorMetadata } from './decorators.types';
export interface GraphNode {
  id: string;
  type: string;
  name: string;
  properties?: Record<string, any>;
  decorators?: DecoratorMetadata[];
}

export interface GraphRelationship {
  from: string;
  to: string;
  type: string;
  properties?: Record<string, any>;
}

export interface GraphData {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
}

export interface NodeVisitor {
  visitNode(node: ts.Node): void;
}

export interface NodeProcessor {
  process(node: ts.Node): void;
}
