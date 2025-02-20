import { NEO4J_CONFIG } from '../constants/config.constants';

export class PropertyFormatter {
  static convertToPrimitive(value: any): any {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((item) => PropertyFormatter.convertToPrimitive(item));
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

  static formatDecorators(decorators: any[]): string {
    return decorators
      .map((d: any) => {
        try {
          const name = String(d.name);
          if (d.arguments) {
            const args = d.arguments.map((arg: any) => PropertyFormatter.convertToPrimitive(arg));
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

  static getNodeLabels(node: any): string {
    const labels = [node.type];

    if (node.type === NEO4J_CONFIG.NODE_TYPES.CLASS && node.properties?.isInjectable) {
      labels.push('Injectable');
    }
    if (node.type === NEO4J_CONFIG.NODE_TYPES.PROVIDER) {
      labels.push('Injectable');
    }
    if (node.type === NEO4J_CONFIG.NODE_TYPES.MODULE && node.properties?.isDynamic) {
      labels.push('DynamicModule');
    }
    if (node.properties?.isExternal) {
      labels.push('External');
    }

    return ':' + labels.join(':');
  }
}
