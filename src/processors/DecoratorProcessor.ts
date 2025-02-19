import ts from 'typescript';
import { BaseProcessor } from './BaseProcessor';
import { DecoratorMetadata } from '../types/decorators.types';

export class DecoratorProcessor extends BaseProcessor {
  public process(node: ts.Node): void {
    if (!ts.canHaveDecorators(node)) return;

    const decorators = this.extractDecorators(node);
    if (decorators.length === 0) return;

    const nodeId = this.generateDecoratedNodeId(node);
    if (!nodeId) return;

    // Add relationships for each decorator
    decorators.forEach((decorator) => {
      const decoratorId = this.generateId('decorator', decorator.name);

      // Create decorator node if it doesn't exist
      if (!this.builder.hasNode(decoratorId)) {
        this.builder.addNode({
          id: decoratorId,
          type: 'Decorator',
          name: decorator.name,
          properties: {
            level: 6,
            hasArguments: decorator.arguments ? decorator.arguments.length > 0 : false,
          },
        });
      }

      // Create relationship between node and its decorator
      this.builder.addRelationship({
        from: nodeId,
        to: decoratorId,
        type: 'HAS_DECORATOR',
        properties: {
          arguments: decorator.arguments || [],
        },
      });
    });
  }

  private generateDecoratedNodeId(node: ts.Node): string | undefined {
    if (ts.isClassDeclaration(node) && node.name) {
      return this.generateId('class', node.name.getText());
    }
    if (ts.isMethodDeclaration(node) && node.name) {
      const parentClass = this.findParentClass(node);
      if (parentClass?.name) {
        return this.generateId('method', `${parentClass.name.getText()}.${node.name.getText()}`);
      }
    }
    if (ts.isPropertyDeclaration(node) && node.name) {
      const parentClass = this.findParentClass(node);
      if (parentClass?.name) {
        return this.generateId('property', `${parentClass.name.getText()}.${node.name.getText()}`);
      }
    }
    if (ts.isParameter(node) && node.name) {
      const parentClass = this.findParentClass(node);
      if (parentClass?.name) {
        return this.generateId('parameter', `${parentClass.name.getText()}.${node.name.getText()}`);
      }
    }
    return undefined;
  }

  public extractDecorators(node: ts.Node): DecoratorMetadata[] {
    const decorators = ts.canHaveDecorators(node) ? ts.getDecorators(node) : undefined;
    if (!decorators) {
      return [];
    }

    return decorators
      .map((decorator) => {
        try {
          if (ts.isCallExpression(decorator.expression)) {
            let decoratorName = decorator.expression.expression.getText();
            decoratorName = decoratorName.replace('@', '');

            const args = decorator.expression.arguments.map((arg) => {
              if (ts.isObjectLiteralExpression(arg)) {
                const config: any = {};
                arg.properties.forEach((prop) => {
                  if (ts.isPropertyAssignment(prop)) {
                    const propName = prop.name.getText();
                    if (ts.isArrayLiteralExpression(prop.initializer)) {
                      config[propName] = prop.initializer.elements.map((e) => e.getText());
                    } else {
                      config[propName] = prop.initializer.getText().replace(/['"]/g, '');
                    }
                  }
                });
                return config;
              }

              if (ts.isStringLiteral(arg)) {
                return arg.text;
              }

              return arg.getText().replace(/['"]/g, '');
            });

            return {
              name: decoratorName,
              arguments: args,
            };
          } else {
            let decoratorName = decorator.expression.getText();
            decoratorName = decoratorName.replace('@', '');

            // Handle special injection decorators
            if (['Inject', 'Injectable', 'Controller', 'Service', 'Module'].includes(decoratorName)) {
              return {
                name: decoratorName,
                arguments: [],
              } as DecoratorMetadata;
            }

            return {
              name: decoratorName,
              arguments: [],
            } as DecoratorMetadata;
          }
        } catch (error) {
          console.error(`Error processing decorator: ${error}`);
          return null;
        }
      })
      .filter((decorator): decorator is NonNullable<DecoratorMetadata> => decorator !== null && 'name' in decorator);
  }
}
