import ts from 'typescript';
import { BaseProcessor, FileContext } from './BaseProcessor';
import { DecoratorMetadata } from '../types/decorators.types';
import { NodeLevel } from '../constants/NodeLevels';

export class DecoratorProcessor extends BaseProcessor {
  public process(node: ts.Node, context?: FileContext): void {
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
            level: NodeLevel.DECORATOR,
            hasArguments: decorator.arguments ? decorator.arguments.length > 0 : false,
          },
        });
      }

      // Solo crear la relación si el nodo decorado existe
      if (this.builder.hasNode(nodeId)) {
        this.builder.addRelationship({
          from: nodeId,
          to: decoratorId,
          type: 'HAS_DECORATOR',
          properties: {
            arguments: decorator.arguments || [],
          },
        });
      }
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

    const parentClass = this.findParentClass(node);
    if (!parentClass?.name) return undefined;

    const parentDecorators = this.extractDecorators(parentClass);
    const isController = parentDecorators.some((d) => d.name === 'Controller');
    const isInjectable = parentDecorators.some((d) => d.name === 'Injectable');
    const parentId = this.generateId(
      isController ? 'controller' : isInjectable ? 'provider' : 'class',
      parentClass.name.getText(),
    );

    if (ts.isMethodDeclaration(node) && node.name) {
      return this.generateId('method', `${parentId}.${node.name.getText().split('(')[0].trim()}`);
    }

    if (ts.isPropertyDeclaration(node) && node.name) {
      return this.generateId('property', `${parentId}.${node.name.getText().split('(')[0].trim()}`);
    }

    if (ts.isParameter(node) && node.name) {
      const parent = node.parent;
      if (ts.isConstructorDeclaration(parent) || ts.isMethodDeclaration(parent)) {
        const methodName = ts.isConstructorDeclaration(parent) ? 'constructor' : parent.name.getText();
        return this.generateId('parameter', `${parentId}.${methodName}.${node.name.getText().split('(')[0].trim()}`);
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
