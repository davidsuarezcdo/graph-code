export const NEO4J_CONFIG = {
  BATCH_SIZE: 100,
  DEFAULT_VALUES: {
    METHOD: {
      VISIBILITY: 'public',
      RETURN_TYPE: 'void',
      INJECTION_TYPE: 'constructor',
    },
    PARAMETER: {
      TYPE: 'any',
    },
    APP_MODULE: {
      ID: 'module_AppModule',
      NAME: 'AppModule',
    },
  },
  NODE_TYPES: {
    MODULE: 'Module',
    CLASS: 'Class',
    INTERFACE: 'Interface',
    DEPENDENCY: 'Dependency',
    METHOD: 'Method',
    PARAMETER: 'Parameter',
    PROVIDER: 'Provider',
    CONTROLLER: 'Controller',
  },
  RELATIONSHIP_TYPES: {
    IMPORTS: 'IMPORTS',
    PROVIDES: 'PROVIDES',
    DECLARES_CONTROLLER: 'DECLARES_CONTROLLER',
    EXTENDS: 'EXTENDS',
    IMPLEMENTS: 'IMPLEMENTS',
    INJECTION: 'INJECTION',
    CALLS: 'CALLS',
    HAS_DYNAMIC_CONFIG: 'HAS_DYNAMIC_CONFIG',
  },
};
