import * as fs from 'fs';
import * as path from 'path';
import { TypeScriptGraphBuilder } from './explorer';
import { GraphStatistics, Neo4jGraphBuilder } from './neo4j';

async function printStatistics(stats: GraphStatistics): Promise<void> {
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
}

async function validateEnvironment(): Promise<void> {
  const requiredEnvVars = ['NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD'];
  const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(`Las siguientes variables de entorno son requeridas: ${missingVars.join(', ')}`);
  }
}

async function main(): Promise<void> {
  let neo4jBuilder: Neo4jGraphBuilder;
  try {
    await validateEnvironment();

    neo4jBuilder = new Neo4jGraphBuilder(process.env.NEO4J_URI!, process.env.NEO4J_USER!, process.env.NEO4J_PASSWORD!);

    console.log('Limpiando base de datos Neo4j...');
    await neo4jBuilder.clearDatabase();
    console.log('Base de datos limpiada correctamente.');

    const projectPath = process.argv[2]?.trim() ?? '';

    if (!projectPath) {
      throw new Error('La ruta del proyecto es requerida como argumento.');
    }

    console.log(`Construyendo grafo desde TypeScript para el proyecto: ${projectPath}`);

    const builder = new TypeScriptGraphBuilder();
    const graph = await builder.buildGraph(projectPath);

    const outputPath = path.join(process.cwd(), 'typescript-graph.json');
    console.log(`Grafo guardado en: ${outputPath}`);

    console.log('Importando grafo a Neo4j...');
    await neo4jBuilder.importGraph(graph.nodes, graph.relationships);
    console.log('Grafo importado correctamente.');

    const stats = await neo4jBuilder.getStatistics();
    fs.writeFileSync(outputPath, JSON.stringify({ graph, stats }, null, 2));
    await printStatistics(stats);
    console.log('Ejecución completada exitosamente.');
    process.exit(0);
  } catch (error) {
    console.error('Error durante la ejecución:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await neo4jBuilder?.close();
  }
}

main();
