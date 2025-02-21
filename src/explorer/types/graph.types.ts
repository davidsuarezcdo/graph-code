import ts from 'typescript';
import { DecoratorMetadata } from './decorators.types';
import { GraphRelationship, GraphNode } from '../../shared/types/graph.types';

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
