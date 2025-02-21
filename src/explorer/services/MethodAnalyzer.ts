import ts from 'typescript';
import { TypeScriptGraphBuilder } from '../core/TypeScriptGraphBuilder';
import { DecoratorProcessor } from '../processors/DecoratorProcessor';
import { generateId, getDocumentation, getVisibility } from '../utils/nodeUtils';

export class MethodAnalyzer {
  private builder: TypeScriptGraphBuilder;
  private decoratorProcessor: DecoratorProcessor;

  constructor(builder: TypeScriptGraphBuilder) {
    this.builder = builder;
    this.decoratorProcessor = new DecoratorProcessor(builder);
  }

  public analyzeClassMethod(node: ts.MethodDeclaration, parentId: string): void {
    const methodName = node.name.getText();
    const methodId = generateId('method', `${parentId}.${methodName}`);
    const visibility = getVisibility(node);
    const returnType = node.type ? node.type.getText() : 'void';
    const isAsync = node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.AsyncKeyword) || false;
    const isStatic = node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.StaticKeyword) || false;
    const isAbstract = node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.AbstractKeyword) || false;
    const extractedDecorators = this.decoratorProcessor.extractDecorators(node);

    // Process parameters
    const parameters = node.parameters.map((param) => ({
      name: param.name.getText(),
      type: param.type ? param.type.getText() : 'any',
      isOptional: param.questionToken !== undefined || param.initializer !== undefined,
      defaultValue: param.initializer ? param.initializer.getText() : undefined,
      decorators: this.decoratorProcessor.extractDecorators(param),
    }));

    // Check if the node already exists before creating it
    if (!this.builder.hasNode(methodId)) {
      // Create method node
      this.builder.addNode({
        id: methodId,
        name: methodName,
        type: 'Method',
        properties: {
          visibility,
          returnType,
          parameterCount: parameters.length,
          parameterTypes: parameters.map((p) => p.type),
          parameterNames: parameters.map((p) => p.name),
          parameterOptional: parameters.map((p) => p.isOptional),
          parameterDefaultValues: parameters.map((p) => p.defaultValue || null),
          parameterDecorators: parameters.map((p) => p.decorators),
          isAsync,
          isStatic,
          isAbstract,
          documentation: getDocumentation(node),
          callCount: 0,
        },
        decorators: extractedDecorators,
      });

      // Create relationship with parent
      this.builder.addRelationship({
        from: parentId,
        to: methodId,
        type: 'HAS_METHOD',
      });

      // Process parameters as separate nodes
      parameters.forEach((param, index) => {
        const paramId = generateId('parameter', `${methodId}_${param.name}`);
        this.builder.addNode({
          id: paramId,
          name: param.name,
          type: 'Parameter',
          properties: {
            type: param.type,
            isOptional: param.isOptional,
            defaultValue: param.defaultValue || null,
            index,
          },
        });

        this.builder.addRelationship({
          from: methodId,
          to: paramId,
          type: 'HAS_PARAMETER',
          properties: {
            index,
          },
        });
      });
    }

    // Process method calls within the method body
    if (node.body) {
      this.analyzeMethodCalls(node.body, methodId);
    }
  }

  private analyzeMethodCalls(node: ts.Node, sourceMethodId: string): void {
    if (ts.isCallExpression(node)) {
      let targetMethod: string | undefined;

      // Identify the called method
      if (ts.isPropertyAccessExpression(node.expression)) {
        targetMethod = node.expression.name.getText();
      } else if (ts.isIdentifier(node.expression)) {
        targetMethod = node.expression.getText();
      }

      if (targetMethod) {
        // Find method in graph and create/update CALLS relationship
        const targetMethodNode = this.builder.findMethodByName(targetMethod);
        if (targetMethodNode) {
          this.builder.addRelationship({
            from: sourceMethodId,
            to: targetMethodNode,
            type: 'CALLS',
            properties: {
              callCount: 1,
            },
          });
        }
      }
    }

    // Recursively process all child nodes
    node.forEachChild((child) => this.analyzeMethodCalls(child, sourceMethodId));
  }
}
