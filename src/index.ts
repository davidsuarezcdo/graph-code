import { TypeScriptGraphBuilder } from './explorer';
import { Neo4jGraphBuilder } from './neo4j';
import * as fs from 'fs';

async function main() {
  const neo4jUri = process.env.NEO4J_URI;
  const neo4jUser = process.env.NEO4J_USER;
  const neo4jPassword = process.env.NEO4J_PASSWORD;

  if (!neo4jUri || !neo4jUser || !neo4jPassword) {
    throw new Error('Las variables de entorno NEO4J_URI, NEO4J_USER y NEO4J_PASSWORD son requeridas');
  }

  const builder = new TypeScriptGraphBuilder();
  const neo4jBuilder = new Neo4jGraphBuilder(neo4jUri, neo4jUser, neo4jPassword);

  try {
    console.log('Limpiando base de datos Neo4j...');
    await neo4jBuilder.clearDatabase();
    console.log('Base de datos limpiada correctamente.');

    console.log('Construyendo grafo desde TypeScript...');
    const graph = await builder.buildGraph('/home/david/compara/conversation-commerce/marketing/marketing-business');
    fs.writeFileSync('typescript-graph.json', JSON.stringify(graph, null, 2));

    console.log('Importando grafo a Neo4j...');
    await neo4jBuilder.importGraph(graph.nodes, graph.relationships);

    const stats = await neo4jBuilder.getStatistics();
    console.log('\nEstadísticas de Neo4j:');
    console.log(`Total de nodos: ${stats.nodes}`);
    console.log(`Total de relaciones: ${stats.relationships}`);

    console.log('\nTipos de nodos:');
    stats.nodeTypes.forEach(({ type, count }) => {
      console.log(`- ${type}: ${count}`);
    });

    console.log('\nTipos de relaciones:');
    stats.relationshipTypes.forEach(({ type, count }) => {
      console.log(`- ${type}: ${count}`);
    });

    if (stats.nestjs) {
      console.log('\nEstadísticas de NestJS:');
      console.log('\nMódulos:');
      console.log(`- Total de módulos: ${stats.nestjs.modules.count}`);
      console.log(`- Módulos dinámicos: ${stats.nestjs.modules.dynamicModules}`);
      console.log(`- Configuraciones dinámicas: ${stats.nestjs.modules.dynamicConfigs}`);
      console.log(`- Total de providers: ${stats.nestjs.modules.totalProviders}`);
      console.log(`- Total de controllers: ${stats.nestjs.modules.totalControllers}`);
      console.log(`- Total de imports: ${stats.nestjs.modules.totalImports}`);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await neo4jBuilder.close();
  }
}

main();
