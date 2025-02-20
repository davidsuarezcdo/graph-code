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
    let typeName = '';

    if (ts.isTypeReferenceNode(typeNode)) {
      typeName = typeNode.typeName.getText().split('<')[0].trim();
    } else if (ts.isArrayTypeNode(typeNode)) {
      typeName = this.getTypeNameFromTypeNode(typeNode.elementType) + '[]';
    } else if (ts.isUnionTypeNode(typeNode)) {
      typeName = typeNode.types.map((t) => this.getTypeNameFromTypeNode(t)).join(' | ');
    } else if (ts.isLiteralTypeNode(typeNode)) {
      typeName = typeNode.literal.getText().split('<')[0].trim();
    } else {
      typeName = typeNode.getText().split('<')[0].trim();
    }

    return typeName;
  }

  private processHeritageClauses(node: ts.ClassDeclaration, nodeId: string): void {
    if (!node.heritageClauses) return;

    node.heritageClauses.forEach((clause) => {
      const isExtends = clause.token === ts.SyntaxKind.ExtendsKeyword;
      const isImplements = clause.token === ts.SyntaxKind.ImplementsKeyword;

      clause.types.forEach((type) => {
        const baseTypeName = type.expression.getText().split('<')[0].trim();

        // Si es una implementación, siempre es una interfaz
        if (isImplements) {
          const baseTypeId = this.generateId('interface', baseTypeName);

          if (!this.builder.hasNode(baseTypeId)) {
            this.builder.addNode({
              id: baseTypeId,
              type: 'Interface',
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
            type: 'IMPLEMENTS',
            properties: {
              sourceType: this.builder.getNode(nodeId)?.type || 'Class',
              targetType: 'Interface',
              typeArguments: type.typeArguments?.map((arg) => arg.getText()) || [],
            },
          });
        }
        // Si es una extensión, necesitamos verificar si la clase base es un Controller/Provider
        else if (isExtends) {
          // Intentamos encontrar la clase base como Controller
          let baseTypeId = this.generateId('controller', baseTypeName);
          let baseType = 'Controller';

          // Si no existe como controller, intentamos como provider
          if (!this.builder.hasNode(baseTypeId)) {
            const providerId = this.generateId('provider', baseTypeName);
            if (this.builder.hasNode(providerId)) {
              baseTypeId = providerId;
              baseType = 'Provider';
            } else {
              // Si no es ni controller ni provider, es una clase normal
              baseTypeId = this.generateId('class', baseTypeName);
              baseType = 'Class';

              // Solo creamos el nodo si no existe en ninguna forma
              if (!this.builder.hasNode(baseTypeId)) {
                this.builder.addNode({
                  id: baseTypeId,
                  type: 'Class',
                  name: baseTypeName,
                  properties: {
                    level: 5,
                    isExternal: true,
                  },
                });
              }
            }
          }

          this.builder.addRelationship({
            from: nodeId,
            to: baseTypeId,
            type: 'EXTENDS',
            properties: {
              sourceType: this.builder.getNode(nodeId)?.type || 'Class',
              targetType: baseType,
              typeArguments: type.typeArguments?.map((arg) => arg.getText()) || [],
            },
          });
        }
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
    const methodName = node.name.getText();
    const methodId = this.generateId('method', `${classId}.${methodName}`);
    const visibility = this.getVisibility(node);
    const returnType = node.type ? node.type.getText() : 'void';
    const isAsync = node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.AsyncKeyword) || false;
    const isStatic = node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.StaticKeyword) || false;
    const isAbstract = node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.AbstractKeyword) || false;

    // Procesar parámetros
    const parameters = node.parameters.map((param) => ({
      name: param.name.getText(),
      type: param.type ? param.type.getText() : 'any',
      isOptional: param.questionToken !== undefined || param.initializer !== undefined,
      defaultValue: param.initializer ? param.initializer.getText() : undefined,
    }));

    // Verificar si el nodo ya existe antes de crearlo
    if (!this.builder.hasNode(methodId)) {
      // Crear nodo de método
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
          isAsync,
          isStatic,
          isAbstract,
          documentation: this.getDocumentation(node),
          callCount: 0, // Inicializar contador de llamadas
        },
      });

      // Crear relación con la clase
      this.builder.addRelationship({
        from: classId,
        to: methodId,
        type: 'HAS_METHOD',
      });

      // Procesar parámetros como nodos separados
      parameters.forEach((param, index) => {
        const paramId = this.generateId('parameter', `${methodId}_${param.name}`);
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

    // Procesar llamadas a métodos dentro del cuerpo del método
    if (node.body) {
      this.processMethodCalls(node.body, methodId);
    }
  }

  private processMethodCalls(node: ts.Node, sourceMethodId: string): void {
    if (ts.isCallExpression(node)) {
      let targetMethod: string | undefined;

      // Identificar el método llamado
      if (ts.isPropertyAccessExpression(node.expression)) {
        targetMethod = node.expression.name.getText();
      } else if (ts.isIdentifier(node.expression)) {
        targetMethod = node.expression.getText();
      }

      if (targetMethod) {
        // Buscar el método en el grafo y crear/actualizar la relación CALLS
        const targetMethodNode = this.findMethodInGraph(targetMethod);
        if (targetMethodNode) {
          this.builder.addRelationship({
            from: sourceMethodId,
            to: targetMethodNode,
            type: 'CALLS',
            properties: {
              callCount: 1, // Incrementar en caso de llamadas múltiples
            },
          });
        }
      }
    }

    // Recursivamente procesar todos los nodos hijos
    node.forEachChild((child) => this.processMethodCalls(child, sourceMethodId));
  }

  private findMethodInGraph(methodName: string): string | undefined {
    return this.builder.findMethodByName(methodName);
  }

  private processProperty(node: ts.PropertyDeclaration, classId: string): void {
    if (!node.name) return;

    const propertyName = node.name.getText().split('(')[0].trim();
    const propertyId = this.generateId('property', `${classId}.${propertyName}`);
    const extractedDecorators = this.decoratorProcessor.extractDecorators(node);
    const propertyType = node.type ? this.getTypeNameFromTypeNode(node.type) : 'any';

    if (!this.builder.hasNode(propertyId)) {
      this.builder.addNode({
        id: propertyId,
        type: 'Property',
        name: propertyName,
        properties: {
          type: propertyType,
          visibility: this.getVisibility(node),
          level: 5,
          isStatic: node.modifiers?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword) || false,
          isReadonly: node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ReadonlyKeyword) || false,
          documentation: this.getDocumentation(node),
        },
        decorators: extractedDecorators,
      });

      this.builder.addRelationship({
        from: classId,
        to: propertyId,
        type: 'HAS_PROPERTY',
      });
    }
  }
}
