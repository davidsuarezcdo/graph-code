/**
 * Base types for graph operations across the application
 */

/**
 * Properties that can be attached to a relationship
 */
export interface RelationshipProperties {
  [key: string]: any;
}

/**
 * Properties that can be attached to a node
 */
export interface NodeProperties {
  [key: string]: any;
}

/**
 * Metadata for decorators in the codebase
 */
export interface DecoratorMetadata {
  name: string;
  arguments?: any[];
}

/**
 * Represents a node in the graph
 */
export interface GraphNode {
  id: string;
  type: string;
  name: string;
  properties?: NodeProperties;
  decorators?: DecoratorMetadata[];
}

/**
 * Represents a relationship between two nodes in the graph
 */
export interface GraphRelationship {
  from: string;
  to: string;
  type: string;
  properties?: RelationshipProperties;
}
