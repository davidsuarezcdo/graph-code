import ts from 'typescript';
import { BaseProcessor } from './BaseProcessor';
import { DecoratorProcessor } from './DecoratorProcessor';

export class ClassProcessor extends BaseProcessor {
  private decoratorProcessor: DecoratorProcessor;

  constructor(builder: any) {
    super(builder);
    this.decoratorProcessor = new DecoratorProcessor(builder);
  }

  public process(node: ts.ClassDeclaration): void {
    if (!node.name) return;

    const className = node.name.getText();
    const extractedDecorators = this.decoratorProcessor.extractDecorators(node);
    const isController = extractedDecorators.some((d) => d.name === 'Controller');
    const isInjectable = extractedDecorators.some((d) => d.name === 'Injectable');

    // Generate the correct ID based on the type of the class
    const classId = this.generateId(isController ? 'controller' : isInjectable ? 'provider' : 'class', className);

    this.builder.addNode({
      id: classId,
      type: isController ? 'Controller' : isInjectable ? 'Provider' : 'Class',
      name: className,
      properties: {
        isAbstract: node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AbstractKeyword) || false,
        documentation: this.getDocumentation(node),
        isInjectable,
        isController,
        level: isController ? 2 : isInjectable ? 3 : 5,
        scope: isInjectable ? 'module' : undefined,
      },
      decorators: extractedDecorators,
    });

    this.processConstructorInjections(node, classId);
    this.processHeritageClauses(node, classId);
    this.processMembers(node, classId);
  }

  private processConstructorInjections(node: ts.ClassDeclaration, classId: string): void {
    const constructor = node.members.find((member) => ts.isConstructorDeclaration(member)) as
      | ts.ConstructorDeclaration
      | undefined;

    if (!constructor) return;

    constructor.parameters.forEach((param) => {
      const paramDecorators = this.decoratorProcessor.extractDecorators(param);
      const paramType = param.type ? this.getTypeNameFromTypeNode(param.type) : undefined;

      if (!paramType) return;

      const cleanParamType = paramType.split('<')[0].trim();
      // Use the clean type name for the provider ID
      const injectedServiceId = this.generateId('provider', cleanParamType);
      const paramName = param.name.getText();

      if (!this.builder.hasNode(injectedServiceId)) {
        this.builder.addNode({
          id: injectedServiceId,
          type: 'Provider',
          name: cleanParamType,
          properties: {
            isInjectable: true,
            scope: 'module',
            level: 3,
          },
        });
      }

      this.builder.addRelationship({
        from: classId,
        to: injectedServiceId,
        type: 'INJECTION',
        properties: {
          parameterName: paramName,
          isOptional: param.questionToken !== undefined,
          decorators: paramDecorators.map((d) => d.name),
          injectionType: 'constructor',
          injectToken: cleanParamType,
        },
      });
    });
  }

  private getTypeNameFromTypeNode(typeNode: ts.TypeNode): string {
    if (ts.isTypeReferenceNode(typeNode)) {
      return typeNode.typeName.getText();
    } else if (ts.isArrayTypeNode(typeNode)) {
      return this.getTypeNameFromTypeNode(typeNode.elementType);
    } else if (ts.isUnionTypeNode(typeNode)) {
      return typeNode.types.map((t) => this.getTypeNameFromTypeNode(t)).join(' | ');
    }
    return typeNode.getText();
  }

  private processHeritageClauses(node: ts.ClassDeclaration, nodeId: string): void {
    if (!node.heritageClauses) return;

    node.heritageClauses.forEach((clause) => {
      const isExtends = clause.token === ts.SyntaxKind.ExtendsKeyword;
      const isImplements = clause.token === ts.SyntaxKind.ImplementsKeyword;

      clause.types.forEach((type) => {
        const baseTypeName = type.expression.getText();
        const baseNodeType = isImplements ? 'interface' : 'class';
        const baseTypeId = this.generateId(baseNodeType, baseTypeName);

        if (!this.builder.hasNode(baseTypeId)) {
          this.builder.addNode({
            id: baseTypeId,
            type: baseNodeType === 'class' ? 'Class' : 'Interface',
            name: baseTypeName,
            properties: {
              level: 5,
              isExternal: true,
            },
          });
        }

        this.builder.addRelationship({
          from: nodeId,
          to: baseTypeId,
          type: isExtends ? 'EXTENDS' : 'IMPLEMENTS',
          properties: {
            sourceType: 'class',
            targetType: baseNodeType,
            typeArguments: type.typeArguments?.map((arg) => arg.getText()) || [],
          },
        });
      });
    });
  }

  private processMembers(node: ts.ClassDeclaration, classId: string): void {
    node.members.forEach((member) => {
      if (ts.isMethodDeclaration(member)) {
        this.processMethod(member, classId);
      } else if (ts.isPropertyDeclaration(member)) {
        this.processProperty(member, classId);
      }
    });
  }

  private processMethod(node: ts.MethodDeclaration, classId: string): void {
    if (!node.name) return;

    const methodName = node.name.getText().split('(')[0].trim();
    const methodId = this.generateId('method', `${classId}.${methodName}`);
    const extractedDecorators = this.decoratorProcessor.extractDecorators(node);

    if (!this.builder.hasNode(methodId)) {
      this.builder.addNode({
        id: methodId,
        type: 'Method',
        name: methodName,
        properties: {
          returnType: node.type ? node.type.getText() : 'void',
          visibility: this.getVisibility(node),
          documentation: this.getDocumentation(node),
          level: 4,
        },
        decorators: extractedDecorators,
      });

      this.builder.addRelationship({
        from: classId,
        to: methodId,
        type: 'HAS_METHOD',
      });
    }
  }

  private processProperty(node: ts.PropertyDeclaration, classId: string): void {
    if (!node.name) return;

    const propertyName = node.name.getText();
    const propertyId = this.generateId('property', `${classId}.${propertyName}`);

    this.builder.addNode({
      id: propertyId,
      type: 'Property',
      name: propertyName,
      properties: {
        type: node.type ? node.type.getText() : 'any',
        visibility: this.getVisibility(node),
      },
      decorators: this.decoratorProcessor.extractDecorators(node),
    });

    this.builder.addRelationship({
      from: classId,
      to: propertyId,
      type: 'HAS_PROPERTY',
    });
  }
}
