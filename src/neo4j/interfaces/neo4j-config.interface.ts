import { GraphRelationship, RelationshipProperties, GraphNode, NodeProperties } from '../../shared/types/graph.types';

export interface Neo4jConfig {
  uri: string;
  username: string;
  password: string;
}

export interface GraphStatistics {
  nodes: number;
  relationships: number;
  nodeTypes: Array<{ type: string; count: number }>;
  relationshipTypes: Array<{ type: string; count: number }>;
  nestjs: {
    modules: {
      count: number;
      totalProviders: number;
      totalControllers: number;
      totalImports: number;
      dynamicModules: number;
      dynamicConfigs: number;
    };
  };
}
