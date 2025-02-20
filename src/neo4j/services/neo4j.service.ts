import neo4j, { Driver, Session } from 'neo4j-driver';
import { Neo4jConfig, GraphNode, GraphRelationship, GraphStatistics } from '../interfaces/neo4j-config.interface';
import { PropertyBuilder } from '../builders/property-builder';
import { PropertyFormatter } from '../utils/property-formatter';
import { NEO4J_INDICES } from '../constants/indices.constants';
import { CYPHER_QUERIES } from '../constants/queries.constants';
import { NEO4J_CONFIG } from '../constants/config.constants';

export class Neo4jService {
  private driver: Driver;

  constructor(config: Neo4jConfig) {
    this.driver = neo4j.driver(config.uri, neo4j.auth.basic(config.username, config.password));
  }

  async close() {
    await this.driver.close();
  }

  private getSession(): Session {
    return this.driver.session();
  }

  async clearDatabase() {
    const session = this.getSession();
    try {
      await session.run(CYPHER_QUERIES.CLEAR_DATABASE.DELETE_ALL);
      await session.run(CYPHER_QUERIES.CLEAR_DATABASE.AWAIT_INDICES);

      const result = await session.run(CYPHER_QUERIES.CLEAR_DATABASE.SHOW_INDICES);
      for (const record of result.records) {
        await session.run(`DROP INDEX ${record.get('name')}`);
      }

      const constraints = await session.run(CYPHER_QUERIES.CLEAR_DATABASE.SHOW_CONSTRAINTS);
      for (const record of constraints.records) {
        await session.run(`DROP CONSTRAINT ${record.get('name')}`);
      }
    } finally {
      await session.close();
    }
  }

  async createIndices() {
    const session = this.getSession();
    try {
      // Basic indices
      await session.run(NEO4J_INDICES.NODE.ID);
      await session.run(NEO4J_INDICES.NODE.NAME);
      await session.run(NEO4J_INDICES.NODE.LEVEL);

      // NestJS specific indices
      await session.run(NEO4J_INDICES.NESTJS.APP_MODULE);
      await session.run(NEO4J_INDICES.NESTJS.MODULE);
      await session.run(NEO4J_INDICES.NESTJS.PROVIDER);
      await session.run(NEO4J_INDICES.NESTJS.CONTROLLER);
      await session.run(NEO4J_INDICES.NESTJS.METHOD.NAME);
      await session.run(NEO4J_INDICES.NESTJS.METHOD.VISIBILITY);
      await session.run(NEO4J_INDICES.NESTJS.METHOD.RETURN_TYPE);
      await session.run(NEO4J_INDICES.NESTJS.METHOD.CALLS);
      await session.run(NEO4J_INDICES.NESTJS.PARAMETER);
      await session.run(NEO4J_INDICES.NESTJS.DYNAMIC.MODULE);
      await session.run(NEO4J_INDICES.NESTJS.DYNAMIC.CONFIG);

      // Class and type indices
      await session.run(NEO4J_INDICES.CLASS.INJECTABLE);
      await session.run(NEO4J_INDICES.CLASS.EXTERNAL);

      // Inheritance indices
      await session.run(NEO4J_INDICES.INHERITANCE.EXTENDS.SOURCE);
      await session.run(NEO4J_INDICES.INHERITANCE.EXTENDS.TARGET);
      await session.run(NEO4J_INDICES.INHERITANCE.IMPLEMENTS.SOURCE);
      await session.run(NEO4J_INDICES.INHERITANCE.IMPLEMENTS.TARGET);

      // Dependency injection indices
      await session.run(NEO4J_INDICES.INJECTION.TYPE);
      await session.run(NEO4J_INDICES.INJECTION.DYNAMIC_CONFIG);
    } finally {
      await session.close();
    }
  }

  private createNodeQuery(labels: string[]): string {
    const labelString = labels.map((label) => `:${label}`).join('');
    return `
      MERGE (n:Node${labelString} {id: $id})
      SET n = $properties
    `;
  }

  private createRelationshipQuery(type: string, properties: Record<string, any>): string {
    return `
      MATCH (from:Node {id: $fromId})
      MATCH (to:Node {id: $toId})
      MERGE (from)-[r:${type}]->(to)
      ${Object.keys(properties).length > 0 ? 'SET r += $properties' : ''}
    `;
  }

  async importGraph(nodes: GraphNode[], relationships: GraphRelationship[]) {
    await this.createIndices();

    const session = this.getSession();
    try {
      await session.executeWrite(async (tx) => {
        await tx.run(CYPHER_QUERIES.GRAPH_OPERATIONS.CREATE_APP_MODULE);
      });
    } finally {
      await session.close();
    }

    for (let i = 0; i < nodes.length; i += NEO4J_CONFIG.BATCH_SIZE) {
      const batch = nodes.slice(i, i + NEO4J_CONFIG.BATCH_SIZE);
      const session = this.getSession();
      try {
        await session.executeWrite(async (tx) => {
          for (const node of batch) {
            const properties = PropertyBuilder.prepareNodeProperties(node);
            const labels = PropertyFormatter.getNodeLabels(node).split(':').filter(Boolean);
            const query = this.createNodeQuery(labels);
            await tx.run(query, {
              id: node.id,
              properties,
            });
          }
        });
      } finally {
        await session.close();
      }
    }

    for (let i = 0; i < relationships.length; i += NEO4J_CONFIG.BATCH_SIZE) {
      const batch = relationships.slice(i, i + NEO4J_CONFIG.BATCH_SIZE);
      const session = this.getSession();
      try {
        await session.executeWrite(async (tx) => {
          for (const rel of batch) {
            const properties = PropertyBuilder.prepareRelationshipProperties(rel.properties || {});
            const query = this.createRelationshipQuery(rel.type, properties);
            await tx.run(query, {
              fromId: rel.from,
              toId: rel.to,
              properties,
            });
          }
        });
      } finally {
        await session.close();
      }
    }

    const session2 = this.getSession();
    try {
      await session2.executeWrite(async (tx) => {
        await tx.run(CYPHER_QUERIES.GRAPH_OPERATIONS.CONNECT_ORPHAN_MODULES);
      });
    } finally {
      await session2.close();
    }
  }

  async getStatistics(): Promise<GraphStatistics> {
    const session = this.getSession();
    try {
      return await session.executeRead(async (tx) => {
        const [nodeCount, relCount, nodeTypes, relTypes, moduleStats] = await Promise.all([
          tx.run(CYPHER_QUERIES.STATISTICS.NODE_COUNT),
          tx.run(CYPHER_QUERIES.STATISTICS.RELATIONSHIP_COUNT),
          tx.run(CYPHER_QUERIES.STATISTICS.NODE_TYPES),
          tx.run(CYPHER_QUERIES.STATISTICS.RELATIONSHIP_TYPES),
          tx.run(CYPHER_QUERIES.STATISTICS.MODULE_STATS),
        ]);

        return {
          nodes: nodeCount.records[0].get('count').toNumber(),
          relationships: relCount.records[0].get('count').toNumber(),
          nodeTypes: nodeTypes.records.map((record) => ({
            type: Array.isArray(record.get('nodeTypes')) ? record.get('nodeTypes')[0] : record.get('nodeTypes'),
            count: record.get('count').toNumber(),
          })),
          relationshipTypes: relTypes.records.map((record) => ({
            type: record.get('type'),
            count: record.get('count').toNumber(),
          })),
          nestjs: {
            modules: {
              count: moduleStats.records[0].get('moduleCount').toNumber(),
              totalProviders: moduleStats.records[0].get('totalProviders').toNumber(),
              totalControllers: moduleStats.records[0].get('totalControllers').toNumber(),
              totalImports: moduleStats.records[0].get('totalImports').toNumber(),
              dynamicModules: moduleStats.records[0].get('dynamicModuleCount').toNumber(),
              dynamicConfigs: moduleStats.records[0].get('totalDynamicConfigs').toNumber(),
            },
          },
        };
      });
    } finally {
      await session.close();
    }
  }
}
