export interface Neo4jConfig {
  uri: string;
  username: string;
  password: string;
}

export interface NodeProperties {
  id: string;
  name: string;
  [key: string]: any;
}

export interface RelationshipProperties {
  [key: string]: any;
}

export interface GraphNode {
  id: string;
  name: string;
  type: string;
  properties?: any;
  decorators?: any[];
}

export interface GraphRelationship {
  from: string;
  to: string;
  type: string;
  properties?: RelationshipProperties;
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
