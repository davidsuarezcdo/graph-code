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
      const className = node.name.getText();
      const decorators = this.extractDecorators(node);
      const isController = decorators.some((d) => d.name === 'Controller');
      const isInjectable = decorators.some((d) => d.name === 'Injectable');
      return this.generateId(isController ? 'controller' : isInjectable ? 'provider' : 'class', className);
    }
    if (ts.isMethodDeclaration(node) && node.name) {
      const parentClass = this.findParentClass(node);
      if (parentClass?.name) {
        const parentDecorators = this.extractDecorators(parentClass);
        const isController = parentDecorators.some((d) => d.name === 'Controller');
        const isInjectable = parentDecorators.some((d) => d.name === 'Injectable');
        const parentId = this.generateId(
          isController ? 'controller' : isInjectable ? 'provider' : 'class',
          parentClass.name.getText(),
        );
        return this.generateId('method', `${parentId}.${node.name.getText().split('(')[0].trim()}`);
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
