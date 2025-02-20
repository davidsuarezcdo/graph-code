export const NEO4J_INDICES = {
  // Basic indices
  NODE: {
    ID: 'CREATE INDEX node_id IF NOT EXISTS FOR (n:Node) ON (n.id)',
    NAME: 'CREATE INDEX node_name IF NOT EXISTS FOR (n:Node) ON (n.name)',
    LEVEL: 'CREATE INDEX node_level IF NOT EXISTS FOR (n:Node) ON (n.level)',
  },

  // NestJS specific indices
  NESTJS: {
    APP_MODULE: 'CREATE INDEX app_module IF NOT EXISTS FOR (n:AppModule) ON (n.id)',
    MODULE: 'CREATE INDEX module_name IF NOT EXISTS FOR (n:Module) ON (n.name)',
    PROVIDER: 'CREATE INDEX provider_name IF NOT EXISTS FOR (n:Provider) ON (n.name)',
    CONTROLLER: 'CREATE INDEX controller_name IF NOT EXISTS FOR (n:Controller) ON (n.name)',
    METHOD: {
      NAME: 'CREATE INDEX method_name IF NOT EXISTS FOR (n:Method) ON (n.name)',
      VISIBILITY: 'CREATE INDEX method_visibility IF NOT EXISTS FOR (n:Method) ON (n.visibility)',
      RETURN_TYPE: 'CREATE INDEX method_return_type IF NOT EXISTS FOR (n:Method) ON (n.returnType)',
      CALLS: 'CREATE INDEX method_calls IF NOT EXISTS FOR ()-[r:CALLS]-() ON (r.callCount)',
    },
    PARAMETER: 'CREATE INDEX method_params IF NOT EXISTS FOR (n:Parameter) ON (n.name)',
    DYNAMIC: {
      MODULE: 'CREATE INDEX dynamic_module IF NOT EXISTS FOR (n:Module) ON (n.isDynamic)',
      CONFIG: 'CREATE INDEX dynamic_config IF NOT EXISTS FOR (n:DynamicModuleConfig) ON (n.methodName)',
    },
  },

  // Class and type indices
  CLASS: {
    INJECTABLE: 'CREATE INDEX injectable_classes IF NOT EXISTS FOR (n:Class) ON (n.isInjectable)',
    EXTERNAL: 'CREATE INDEX external_types IF NOT EXISTS FOR (n:Node) ON (n.isExternal)',
  },

  // Inheritance indices
  INHERITANCE: {
    EXTENDS: {
      SOURCE: 'CREATE INDEX inheritance_source_extends IF NOT EXISTS FOR ()-[r:EXTENDS]-() ON (r.sourceType)',
      TARGET: 'CREATE INDEX inheritance_target_extends IF NOT EXISTS FOR ()-[r:EXTENDS]-() ON (r.targetType)',
    },
    IMPLEMENTS: {
      SOURCE: 'CREATE INDEX inheritance_source_implements IF NOT EXISTS FOR ()-[r:IMPLEMENTS]-() ON (r.sourceType)',
      TARGET: 'CREATE INDEX inheritance_target_implements IF NOT EXISTS FOR ()-[r:IMPLEMENTS]-() ON (r.targetType)',
    },
  },

  // Dependency injection indices
  INJECTION: {
    TYPE: 'CREATE INDEX injection_type IF NOT EXISTS FOR ()-[r:INJECTION]-() ON (r.injectionType)',
    DYNAMIC_CONFIG: 'CREATE INDEX dynamic_config_method IF NOT EXISTS FOR ()-[r:HAS_DYNAMIC_CONFIG]-() ON (r.method)',
  },
};
