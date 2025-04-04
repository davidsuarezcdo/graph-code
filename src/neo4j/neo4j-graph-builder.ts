import { Neo4jService } from './services/neo4j.service';
import { Neo4jConfig, GraphStatistics } from './interfaces/neo4j-config.interface';
import { GraphRelationship, GraphNode } from '../shared/types/graph.types';

export class Neo4jGraphBuilder {
  private neo4jService: Neo4jService;
  private projectBaseName: string;

  constructor(uri: string, username: string, password: string, projectBaseName?: string) {
    const config: Neo4jConfig = { uri, username, password };
    this.neo4jService = new Neo4jService(config);
    this.projectBaseName = projectBaseName || '';
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
    // Procesar las rutas de archivo en los nodos si es necesario
    if (this.projectBaseName) {
      nodes = this.processNodePaths(nodes);
    }

    await this.neo4jService.importGraph(nodes, relationships);
  }

  /**
   * Procesa las rutas de archivo en los nodos para convertirlas a rutas relativas
   */
  private processNodePaths(nodes: GraphNode[]): GraphNode[] {
    return nodes.map((node) => {
      // Si el nodo tiene una propiedad filepath, convertirla a ruta relativa
      if (node.properties?.filepath && typeof node.properties.filepath === 'string') {
        const filepath = node.properties.filepath;
        const parts = filepath.split(this.projectBaseName);

        if (parts.length > 1) {
          // Tomar la parte después del nombre base y eliminar el separador inicial
          node.properties.filepath = parts[parts.length - 1].replace(/^[\/\\]/, '');
        }
      }
      return node;
    });
  }

  async getStatistics(): Promise<GraphStatistics> {
    return await this.neo4jService.getStatistics();
  }
}
