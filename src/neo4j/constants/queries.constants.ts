export const CYPHER_QUERIES = {
  CLEAR_DATABASE: {
    DELETE_ALL: 'MATCH (n) DETACH DELETE n',
    AWAIT_INDICES: 'CALL db.awaitIndexes()',
    SHOW_INDICES: 'SHOW INDEXES YIELD name RETURN name',
    SHOW_CONSTRAINTS: 'SHOW CONSTRAINTS YIELD name RETURN name',
  },

  STATISTICS: {
    NODE_COUNT: 'MATCH (n) RETURN count(n) as count',
    RELATIONSHIP_COUNT: 'MATCH ()-[r]->() RETURN count(r) as count',
    NODE_TYPES: `
      MATCH (n)
      WITH CASE 
        WHEN size([label IN labels(n) WHERE label <> 'Node']) > 0 
        THEN [label IN labels(n) WHERE label <> 'Node']
        ELSE [n.type]
      END as nodeTypes, count(*) as count
      RETURN DISTINCT nodeTypes, count
      ORDER BY count DESC
    `,
    RELATIONSHIP_TYPES: `
      MATCH ()-[r]->()
      WITH type(r) as type, count(*) as count
      RETURN type, count
      ORDER BY count DESC
    `,
    MODULE_STATS: `
      MATCH (m:Module)
      OPTIONAL MATCH (m)-[:PROVIDES]->(p:Provider)
      OPTIONAL MATCH (m)-[:DECLARES_CONTROLLER]->(c:Controller)
      OPTIONAL MATCH (m)-[:IMPORTS]->(i:Module)
      OPTIONAL MATCH (m)-[:HAS_DYNAMIC_CONFIG]->(d:DynamicModuleConfig)
      WITH m, 
           count(DISTINCT p) as providerCount,
           count(DISTINCT c) as controllerCount,
           count(DISTINCT i) as importCount,
           count(DISTINCT d) as dynamicConfigCount,
           m.isDynamic as isDynamic
      RETURN 
          count(m) as moduleCount,
          sum(providerCount) as totalProviders,
          sum(controllerCount) as totalControllers,
          sum(importCount) as totalImports,
          sum(CASE WHEN isDynamic THEN 1 ELSE 0 END) as dynamicModuleCount,
          sum(dynamicConfigCount) as totalDynamicConfigs
    `,
  },

  GRAPH_OPERATIONS: {
    CREATE_APP_MODULE: `
      MERGE (app:Node:Module:AppModule {id: 'module_AppModule', name: 'AppModule'})
    `,
    CONNECT_ORPHAN_MODULES: `
      MATCH (m:Module)
      WHERE NOT ()-[:IMPORTS]->(m) AND m.id <> 'module_AppModule'
      MATCH (app:AppModule {id: 'module_AppModule'})
      MERGE (app)-[:IMPORTS]->(m)
    `,
  },
};
