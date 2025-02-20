import neo4j, { Driver, Session } from 'neo4j-driver';

export class Neo4jGraphBuilder {
  private driver: Driver;

  constructor(uri: string, username: string, password: string) {
    this.driver = neo4j.driver(uri, neo4j.auth.basic(username, password));
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
      // Eliminar todos los nodos y relaciones
      await session.run('MATCH (n) DETACH DELETE n');

      // Esperar a que los índices estén en línea
      await session.run('CALL db.awaitIndexes()');

      // Eliminar todos los índices
      await session.run('SHOW INDEXES');
      const result = await session.run('SHOW INDEXES YIELD name RETURN name');
      for (const record of result.records) {
        await session.run(`DROP INDEX ${record.get('name')}`);
      }

      // Eliminar todas las restricciones
      const constraints = await session.run('SHOW CONSTRAINTS YIELD name RETURN name');
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
      // Índices básicos
      await session.run('CREATE INDEX node_id IF NOT EXISTS FOR (n:Node) ON (n.id)');
      await session.run('CREATE INDEX node_name IF NOT EXISTS FOR (n:Node) ON (n.name)');
      await session.run('CREATE INDEX node_level IF NOT EXISTS FOR (n:Node) ON (n.level)');

      // Índice para AppModule
      await session.run('CREATE INDEX app_module IF NOT EXISTS FOR (n:AppModule) ON (n.id)');

      // Índices específicos para NestJS
      await session.run('CREATE INDEX module_name IF NOT EXISTS FOR (n:Module) ON (n.name)');
      await session.run('CREATE INDEX provider_name IF NOT EXISTS FOR (n:Provider) ON (n.name)');
      await session.run('CREATE INDEX controller_name IF NOT EXISTS FOR (n:Controller) ON (n.name)');

      // Nuevos índices para métodos y parámetros
      await session.run('CREATE INDEX method_name IF NOT EXISTS FOR (n:Method) ON (n.name)');
      await session.run('CREATE INDEX method_visibility IF NOT EXISTS FOR (n:Method) ON (n.visibility)');
      await session.run('CREATE INDEX method_params IF NOT EXISTS FOR (n:Parameter) ON (n.name)');
      await session.run('CREATE INDEX method_return_type IF NOT EXISTS FOR (n:Method) ON (n.returnType)');
      await session.run('CREATE INDEX method_calls IF NOT EXISTS FOR ()-[r:CALLS]-() ON (r.callCount)');

      // Índices para módulos dinámicos
      await session.run('CREATE INDEX dynamic_module IF NOT EXISTS FOR (n:Module) ON (n.isDynamic)');
      await session.run('CREATE INDEX dynamic_config IF NOT EXISTS FOR (n:DynamicModuleConfig) ON (n.methodName)');

      // Índices para búsqueda de decoradores
      await session.run('CREATE INDEX injectable_classes IF NOT EXISTS FOR (n:Class) ON (n.isInjectable)');

      // Índices para relaciones de herencia y tipos externos
      await session.run('CREATE INDEX external_types IF NOT EXISTS FOR (n:Node) ON (n.isExternal)');
      await session.run(
        'CREATE INDEX inheritance_source_extends IF NOT EXISTS FOR ()-[r:EXTENDS]-() ON (r.sourceType)',
      );
      await session.run(
        'CREATE INDEX inheritance_source_implements IF NOT EXISTS FOR ()-[r:IMPLEMENTS]-() ON (r.sourceType)',
      );
      await session.run(
        'CREATE INDEX inheritance_target_extends IF NOT EXISTS FOR ()-[r:EXTENDS]-() ON (r.targetType)',
      );
      await session.run(
        'CREATE INDEX inheritance_target_implements IF NOT EXISTS FOR ()-[r:IMPLEMENTS]-() ON (r.targetType)',
      );

      // Índice para relaciones de inyección y configuración dinámica
      await session.run('CREATE INDEX injection_type IF NOT EXISTS FOR ()-[r:INJECTION]-() ON (r.injectionType)');
      await session.run(
        'CREATE INDEX dynamic_config_method IF NOT EXISTS FOR ()-[r:HAS_DYNAMIC_CONFIG]-() ON (r.method)',
      );
    } finally {
      await session.close();
    }
  }

  async importGraph(nodes: any[], relationships: any[]) {
    // Crear índices primero
    await this.createIndices();

    // Crear AppModule como punto de entrada
    const session = this.getSession();
    try {
      await session.executeWrite(async (tx) => {
        await tx.run(`
          MERGE (app:Node:Module:AppModule {id: 'module_AppModule', name: 'AppModule'})
        `);
      });
    } finally {
      await session.close();
    }

    // Importar nodos en lotes usando transacciones
    const batchSize = 100;
    for (let i = 0; i < nodes.length; i += batchSize) {
      const batch = nodes.slice(i, i + batchSize);
      const session = this.getSession();
      try {
        await session.executeWrite(async (tx) => {
          for (const node of batch) {
            const properties = this.prepareNodeProperties(node);
            const labels = this.getNodeLabels(node);
            await tx.run(
              `
              MERGE (n:Node {id: $id})
              SET n = $properties
              SET n${labels}
            `,
              {
                id: node.id,
                properties,
              },
            );
          }
        });
      } finally {
        await session.close();
      }
    }

    // Importar relaciones en lotes usando transacciones
    for (let i = 0; i < relationships.length; i += batchSize) {
      const batch = relationships.slice(i, i + batchSize);
      const session = this.getSession();
      try {
        await session.executeWrite(async (tx) => {
          for (const rel of batch) {
            const properties = this.prepareRelationshipProperties(rel.properties || {});
            await tx.run(
              `
              MATCH (from:Node {id: $fromId})
              MATCH (to:Node {id: $toId})
              MERGE (from)-[r:${rel.type}]->(to)
              ${Object.keys(properties).length > 0 ? 'SET r += $properties' : ''}
            `,
              {
                fromId: rel.from,
                toId: rel.to,
                properties,
              },
            );
          }
        });
      } finally {
        await session.close();
      }
    }

    // Conectar módulos independientes al AppModule
    const session2 = this.getSession();
    try {
      await session2.executeWrite(async (tx) => {
        // Conectar módulos que no son importados por otros al AppModule
        await tx.run(`
          MATCH (m:Module)
          WHERE NOT ()-[:IMPORTS]->(m) AND m.id <> 'module_AppModule'
          MATCH (app:AppModule {id: 'module_AppModule'})
          MERGE (app)-[:IMPORTS]->(m)
        `);
      });
    } finally {
      await session2.close();
    }
  }

  private prepareRelationshipProperties(properties: any): any {
    const result: any = {};

    for (const [key, value] of Object.entries(properties)) {
      if (value === null || value === undefined) {
        continue;
      }

      if (typeof value === 'boolean') {
        result[key] = value;
      } else if (Array.isArray(value)) {
        // Manejar arrays de argumentos de tipo
        if (key === 'typeArguments') {
          result[key] = value.map(String);
        } else {
          result[key] = value.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v)));
        }
      } else if (typeof value === 'object') {
        result[key] = JSON.stringify(value);
      } else {
        result[key] = String(value);
      }
    }

    // Asegurar que las propiedades de herencia estén presentes
    if (properties.sourceType) {
      result.sourceType = String(properties.sourceType);
    }
    if (properties.targetType) {
      result.targetType = String(properties.targetType);
    }

    return result;
  }

  private prepareNodeProperties(node: any) {
    // Crear un nuevo objeto para las propiedades
    const properties: any = {
      id: node.id,
      name: node.name,
    };

    // Convertir propiedades a tipos primitivos
    if (node.properties) {
      Object.entries(node.properties).forEach(([key, value]) => {
        if (value === null || value === undefined) {
          return;
        }
        if (typeof value === 'boolean') {
          properties[key] = value;
        } else if (Array.isArray(value)) {
          // Filtrar valores nulos y convertir a tipos primitivos
          properties[key] = value
            .filter((item) => item !== null && item !== undefined)
            .map((item) => {
              if (typeof item === 'object') {
                return JSON.stringify(item);
              }
              return String(item);
            });
        } else if (typeof value === 'object') {
          properties[key] = JSON.stringify(value);
        } else {
          properties[key] = String(value);
        }
      });
    }

    // Procesar decoradores
    if (node.decorators?.length > 0) {
      properties.decorators = this.formatDecorators(node.decorators);
      properties.decoratorNames = node.decorators.filter((d: any) => d && d.name).map((d: any) => String(d.name));
    }

    // Propiedades específicas por tipo de nodo
    switch (node.type) {
      case 'Module':
        properties.importCount = Number(node.properties?.imports?.length || 0);
        properties.exportCount = Number(node.properties?.exports?.length || 0);
        properties.providerCount = Number(node.properties?.providers?.length || 0);
        properties.controllerCount = Number(node.properties?.controllers?.length || 0);

        // Filtrar y convertir arrays
        if (node.properties?.imports?.length) {
          properties.imports = node.properties.imports.filter((i: any) => i !== null && i !== undefined).map(String);
        }
        if (node.properties?.exports?.length) {
          properties.exports = node.properties.exports.filter((e: any) => e !== null && e !== undefined).map(String);
        }
        if (node.properties?.providers?.length) {
          properties.providers = node.properties.providers
            .filter((p: any) => p !== null && p !== undefined)
            .map(String);
        }
        if (node.properties?.controllers?.length) {
          properties.controllers = node.properties.controllers
            .filter((c: any) => c !== null && c !== undefined)
            .map(String);
        }

        properties.isGlobal = Boolean(node.properties?.isGlobal);
        properties.isDynamic = Boolean(node.properties?.isDynamic);
        break;
      case 'Class':
        properties.isInjectable = Boolean(node.properties?.isInjectable);
        properties.isAbstract = Boolean(node.properties?.isAbstract);
        properties.isExternal = Boolean(node.properties?.isExternal);
        if (properties.isInjectable) {
          properties.injectableType = 'class';
        }
        break;
      case 'Interface':
        properties.isExternal = Boolean(node.properties?.isExternal);
        break;
      case 'Dependency':
        properties.isOptional = Boolean(node.properties?.isOptional);
        properties.injectionType = String(node.properties?.injectionType || 'constructor');
        break;
      case 'Method':
        properties.visibility = String(node.properties?.visibility || 'public');
        properties.returnType = String(node.properties?.returnType || 'void');
        properties.parameterCount = Number(node.properties?.parameterCount || 0);

        // Manejar arrays de parámetros, filtrando valores nulos
        const paramTypes = (node.properties?.parameterTypes || [])
          .filter((t) => t !== null && t !== undefined)
          .map(String);
        const paramNames = (node.properties?.parameterNames || [])
          .filter((n) => n !== null && n !== undefined)
          .map(String);
        const paramOptional = (node.properties?.parameterOptional || [])
          .filter((o) => o !== null && o !== undefined)
          .map(Boolean);
        const paramDefaults = (node.properties?.parameterDefaultValues || [])
          .filter((v) => v !== null && v !== undefined)
          .map(String);

        // Solo guardar arrays no vacíos
        if (paramTypes.length > 0) properties.parameterTypes = paramTypes;
        if (paramNames.length > 0) properties.parameterNames = paramNames;
        if (paramOptional.length > 0) properties.parameterOptional = paramOptional;
        if (paramDefaults.length > 0) properties.parameterDefaultValues = paramDefaults;

        properties.isAsync = Boolean(node.properties?.isAsync);
        properties.isStatic = Boolean(node.properties?.isStatic);
        properties.isAbstract = Boolean(node.properties?.isAbstract);
        properties.callCount = Number(node.properties?.callCount || 0);
        break;
      case 'Parameter':
        properties.type = String(node.properties?.type || 'any');
        properties.isOptional = Boolean(node.properties?.isOptional);
        // Solo guardar defaultValue si no es nulo
        if (node.properties?.defaultValue) {
          properties.defaultValue = String(node.properties.defaultValue);
        }
        properties.index = Number(node.properties?.index || 0);
        break;
    }

    return properties;
  }

  private convertToPrimitive(value: any): any {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.convertToPrimitive(item));
    }
    if (typeof value === 'object') {
      if (value instanceof Date) {
        return value.toISOString();
      }
      if (value instanceof Map) {
        return JSON.stringify(Object.fromEntries(value));
      }
      return JSON.stringify(value);
    }
    return String(value);
  }

  private formatDecorators(decorators: any[]): string {
    return decorators
      .map((d: any) => {
        try {
          const name = String(d.name);
          if (d.arguments) {
            const args = d.arguments.map((arg: any) => this.convertToPrimitive(arg));
            return `@${name}(${JSON.stringify(args)})`;
          }
          return `@${name}`;
        } catch (error) {
          console.warn(`Error formateando decorador: ${error}`);
          return `@Unknown`;
        }
      })
      .join('\n');
  }

  private getNodeLabels(node: any): string {
    const labels = [node.type];

    // Añadir etiquetas adicionales basadas en propiedades
    if (node.type === 'Class' && node.properties?.isInjectable) {
      labels.push('Injectable');
    }
    if (node.type === 'Provider') {
      labels.push('Injectable');
    }
    if (node.type === 'Module' && node.properties?.isDynamic) {
      labels.push('DynamicModule');
    }
    if (node.properties?.isExternal) {
      labels.push('External');
    }

    return ':' + labels.join(':');
  }

  async getStatistics() {
    const session = this.getSession();
    try {
      return await session.executeRead(async (tx) => {
        const [nodeCount, relCount, nodeTypes, relTypes, moduleStats] = await Promise.all([
          tx.run('MATCH (n) RETURN count(n) as count'),
          tx.run('MATCH ()-[r]->() RETURN count(r) as count'),
          tx.run(`
            MATCH (n)
            WITH CASE 
              WHEN size([label IN labels(n) WHERE label <> 'Node']) > 0 
              THEN [label IN labels(n) WHERE label <> 'Node']
              ELSE [n.type]
            END as nodeTypes, count(*) as count
            RETURN DISTINCT nodeTypes, count
            ORDER BY count DESC
          `),
          tx.run(`
            MATCH ()-[r]->()
            WITH type(r) as type, count(*) as count
            RETURN type, count
            ORDER BY count DESC
          `),
          tx.run(`
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
          `),
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
