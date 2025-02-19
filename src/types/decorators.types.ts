export interface DecoratorMetadata {
  name: string;
  arguments?: any[];
}

export interface ModuleDecoratorMetadata {
  imports?: any[];
  exports?: any[];
  providers?: any[];
  controllers?: any[];
  global?: boolean;
}

export interface ConstructorInjectionMetadata {
  parameterName: string;
  isOptional: boolean;
  decorators: string[];
  injectionType: 'constructor';
  injectToken: string;
}
