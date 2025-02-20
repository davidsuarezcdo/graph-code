import { PropertyFormatter } from '../utils/property-formatter';
import { NodeProperties, RelationshipProperties } from '../interfaces/neo4j-config.interface';
import { NEO4J_CONFIG } from '../constants/config.constants';

export class PropertyBuilder {
  static prepareNodeProperties(node: any): NodeProperties {
    const properties: NodeProperties = {
      id: node.id,
      name: node.name,
    };

    if (node.properties) {
      Object.entries(node.properties).forEach(([key, value]) => {
        if (value === null || value === undefined) {
          return;
        }
        if (typeof value === 'boolean') {
          properties[key] = value;
        } else if (Array.isArray(value)) {
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

    if (node.decorators?.length > 0) {
      properties.decorators = PropertyFormatter.formatDecorators(node.decorators);
      properties.decoratorNames = node.decorators.filter((d: any) => d && d.name).map((d: any) => String(d.name));
    }

    this.addTypeSpecificProperties(node, properties);

    return properties;
  }

  static prepareRelationshipProperties(properties: any): RelationshipProperties {
    const result: RelationshipProperties = {};

    for (const [key, value] of Object.entries(properties)) {
      if (value === null || value === undefined) {
        continue;
      }

      if (typeof value === 'boolean') {
        result[key] = value;
      } else if (Array.isArray(value)) {
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

    if (properties.sourceType) {
      result.sourceType = String(properties.sourceType);
    }
    if (properties.targetType) {
      result.targetType = String(properties.targetType);
    }

    return result;
  }

  private static addTypeSpecificProperties(node: any, properties: NodeProperties): void {
    switch (node.type) {
      case NEO4J_CONFIG.NODE_TYPES.MODULE:
        this.addModuleProperties(node, properties);
        break;
      case NEO4J_CONFIG.NODE_TYPES.CLASS:
        this.addClassProperties(node, properties);
        break;
      case NEO4J_CONFIG.NODE_TYPES.INTERFACE:
        this.addInterfaceProperties(node, properties);
        break;
      case NEO4J_CONFIG.NODE_TYPES.DEPENDENCY:
        this.addDependencyProperties(node, properties);
        break;
      case NEO4J_CONFIG.NODE_TYPES.METHOD:
        this.addMethodProperties(node, properties);
        break;
      case NEO4J_CONFIG.NODE_TYPES.PARAMETER:
        this.addParameterProperties(node, properties);
        break;
    }
  }

  private static addModuleProperties(node: any, properties: NodeProperties): void {
    properties.importCount = Number(node.properties?.imports?.length || 0);
    properties.exportCount = Number(node.properties?.exports?.length || 0);
    properties.providerCount = Number(node.properties?.providers?.length || 0);
    properties.controllerCount = Number(node.properties?.controllers?.length || 0);

    if (node.properties?.imports?.length) {
      properties.imports = node.properties.imports.filter((i: any) => i !== null && i !== undefined).map(String);
    }
    if (node.properties?.exports?.length) {
      properties.exports = node.properties.exports.filter((e: any) => e !== null && e !== undefined).map(String);
    }
    if (node.properties?.providers?.length) {
      properties.providers = node.properties.providers.filter((p: any) => p !== null && p !== undefined).map(String);
    }
    if (node.properties?.controllers?.length) {
      properties.controllers = node.properties.controllers
        .filter((c: any) => c !== null && c !== undefined)
        .map(String);
    }

    properties.isGlobal = Boolean(node.properties?.isGlobal);
    properties.isDynamic = Boolean(node.properties?.isDynamic);
  }

  private static addClassProperties(node: any, properties: NodeProperties): void {
    properties.isInjectable = Boolean(node.properties?.isInjectable);
    properties.isAbstract = Boolean(node.properties?.isAbstract);
    properties.isExternal = Boolean(node.properties?.isExternal);
    if (properties.isInjectable) {
      properties.injectableType = 'class';
    }
  }

  private static addInterfaceProperties(node: any, properties: NodeProperties): void {
    properties.isExternal = Boolean(node.properties?.isExternal);
  }

  private static addDependencyProperties(node: any, properties: NodeProperties): void {
    properties.isOptional = Boolean(node.properties?.isOptional);
    properties.injectionType = String(
      node.properties?.injectionType || NEO4J_CONFIG.DEFAULT_VALUES.METHOD.INJECTION_TYPE,
    );
  }

  private static addMethodProperties(node: any, properties: NodeProperties): void {
    properties.visibility = String(node.properties?.visibility || NEO4J_CONFIG.DEFAULT_VALUES.METHOD.VISIBILITY);
    properties.returnType = String(node.properties?.returnType || NEO4J_CONFIG.DEFAULT_VALUES.METHOD.RETURN_TYPE);
    properties.parameterCount = Number(node.properties?.parameterCount || 0);

    const paramTypes = (node.properties?.parameterTypes || [])
      .filter((t: any) => t !== null && t !== undefined)
      .map(String);
    const paramNames = (node.properties?.parameterNames || [])
      .filter((n: any) => n !== null && n !== undefined)
      .map(String);
    const paramOptional = (node.properties?.parameterOptional || [])
      .filter((o: any) => o !== null && o !== undefined)
      .map(Boolean);
    const paramDefaults = (node.properties?.parameterDefaultValues || [])
      .filter((v: any) => v !== null && v !== undefined)
      .map(String);

    if (paramTypes.length > 0) properties.parameterTypes = paramTypes;
    if (paramNames.length > 0) properties.parameterNames = paramNames;
    if (paramOptional.length > 0) properties.parameterOptional = paramOptional;
    if (paramDefaults.length > 0) properties.parameterDefaultValues = paramDefaults;

    properties.isAsync = Boolean(node.properties?.isAsync);
    properties.isStatic = Boolean(node.properties?.isStatic);
    properties.isAbstract = Boolean(node.properties?.isAbstract);
    properties.callCount = Number(node.properties?.callCount || 0);
  }

  private static addParameterProperties(node: any, properties: NodeProperties): void {
    properties.type = String(node.properties?.type || NEO4J_CONFIG.DEFAULT_VALUES.PARAMETER.TYPE);
    properties.isOptional = Boolean(node.properties?.isOptional);
    if (node.properties?.defaultValue) {
      properties.defaultValue = String(node.properties.defaultValue);
    }
    properties.index = Number(node.properties?.index || 0);
  }
}
