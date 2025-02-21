export enum NodeLevel {
  APP_MODULE = 1,
  CONTROLLER = 2,
  PROVIDER = 3,
  METHOD = 4,
  CLASS = 5,
  DECORATOR = 6,
  INTERFACE = 7,
}

// Optional: Add descriptions for better documentation
export const NodeLevelDescription = {
  [NodeLevel.APP_MODULE]: 'Top level application module',
  [NodeLevel.CONTROLLER]: 'NestJS Controllers',
  [NodeLevel.PROVIDER]: 'NestJS Providers/Services',
  [NodeLevel.METHOD]: 'Class methods and endpoints',
  [NodeLevel.CLASS]: 'Regular TypeScript classes',
  [NodeLevel.DECORATOR]: 'TypeScript/NestJS decorators',
  [NodeLevel.INTERFACE]: 'TypeScript interfaces',
};
