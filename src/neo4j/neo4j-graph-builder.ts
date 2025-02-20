import { Neo4jService } from './services/neo4j.service';
import { Neo4jConfig, GraphNode, GraphRelationship, GraphStatistics } from './interfaces/neo4j-config.interface';

export class Neo4jGraphBuilder {
  private neo4jService: Neo4jService;

  constructor(uri: string, username: string, password: string) {
    const config: Neo4jConfig = { uri, username, password };
    this.neo4jService = new Neo4jService(config);
  }

  async close() {
    try {
      await this.neo4jService.close();
    } catch (error) {
      console.error('Error al cerrar la conexión con Neo4j:', error instanceof Error ? error.message : error);
    }
  }

  async clearDatabase() {
    await this.neo4jService.clearDatabase();
  }

  async createIndices() {
    await this.neo4jService.createIndices();
  }

  async importGraph(nodes: GraphNode[], relationships: GraphRelationship[]) {
    await this.neo4jService.importGraph(nodes, relationships);
  }

  async getStatistics(): Promise<GraphStatistics> {
    return await this.neo4jService.getStatistics();
  }
}
