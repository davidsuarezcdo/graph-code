import ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';

interface GraphNode {
  id: string;
  type: string;
  name: string;
  properties?: Record<string, any>;
  decorators?: Array<{
    name: string;
    arguments?: any[];
  }>;
}

interface GraphRelationship {
  from: string;
  to: string;
  type: string;
  properties?: Record<string, any>;
}

export class TypeScriptGraphBuilder {
  private nodes: Map<string, GraphNode> = new Map();
  private relationships: GraphRelationship[] = [];
  private typeChecker: ts.TypeChecker | undefined;

  constructor() {}

  public async buildGraph(rootPath: string): Promise<{ nodes: GraphNode[]; relationships: GraphRelationship[] }> {
    const configPath = ts.findConfigFile(rootPath, ts.sys.fileExists, 'tsconfig.json');

    if (!configPath) {
      throw new Error("Could not find a valid 'tsconfig.json'.");
    }

    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(configPath));

    const compilerOptions: ts.CompilerOptions = {
      ...parsedConfig.options,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
    };

    const program = ts.createProgram({
      rootNames: parsedConfig.fileNames,
      options: compilerOptions,
    });

    this.typeChecker = program.getTypeChecker();

    for (const sourceFile of program.getSourceFiles()) {
      if (!sourceFile.isDeclarationFile) {
        this.visitNode(sourceFile);
      }
    }

    return {
      nodes: Array.from(this.nodes.values()),
      relationships: this.relationships,
    };
  }

  private visitNode(node: ts.Node): void {
    switch (node.kind) {
      case ts.SyntaxKind.ClassDeclaration:
        this.processClass(node as ts.ClassDeclaration);
        break;
      case ts.SyntaxKind.InterfaceDeclaration:
        this.processInterface(node as ts.InterfaceDeclaration);
        break;
      case ts.SyntaxKind.EnumDeclaration:
        this.processEnum(node as ts.EnumDeclaration);
        break;
      case ts.SyntaxKind.MethodDeclaration:
        this.processMethod(node as ts.MethodDeclaration);
        break;
      case ts.SyntaxKind.PropertyDeclaration:
        this.processProperty(node as ts.PropertyDeclaration);
        break;
    }

    // Procesar decoradores de módulo NestJS
    if (ts.isClassDeclaration(node)) {
      this.processModuleDecorator(node);
    }

    ts.forEachChild(node, (child) => this.visitNode(child));
  }

  private processModuleDecorator(node: ts.ClassDeclaration): void {
    if (!node.name) return;

    const decorators = this.extractDecorators(node);
    console.log(
      `Processing class ${node.name.getText()} with decorators:`,
      decorators.map((d) => d.name),
    );

    // Check for both @Module decorator and forRoot/forFeature methods
    const moduleDecorator = decorators.find((d) => d.name === 'Module');
    const moduleId = this.generateId('module', node.name.getText());

    // Process static module configuration if @Module decorator exists
    if (moduleDecorator && moduleDecorator.arguments?.[0]) {
      try {
        const moduleMetadata =
          typeof moduleDecorator.arguments[0] === 'string'
            ? JSON.parse(moduleDecorator.arguments[0])
            : moduleDecorator.arguments[0];

        console.log(`Static module metadata for ${node.name.getText()}:`, moduleMetadata);
        this.processModule(moduleMetadata, moduleId, node.name.getText());
      } catch (error) {
        console.error(`Error parsing static module metadata for ${node.name.getText()}:`, error);
      }
    }

    // Process dynamic module methods (forRoot, forFeature, etc.)
    this.processDynamicModuleMethods(node, moduleId);
  }

  private processDynamicModuleMethods(node: ts.ClassDeclaration, moduleId: string): void {
    if (!node.members) return;

    const dynamicMethods = node.members.filter(
      (member): member is ts.MethodDeclaration =>
        ts.isMethodDeclaration(member) &&
        member.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.StaticKeyword) &&
        (member.name.getText() === 'forRoot' ||
          member.name.getText() === 'forFeature' ||
          member.name.getText() === 'register'),
    );

    dynamicMethods.forEach((method) => {
      const methodName = method.name.getText();
      console.log(`Processing dynamic module method ${methodName} for ${node.name?.getText()}`);

      // Add node for the dynamic module configuration
      const dynamicConfigId = this.generateId('dynamic_config', `${node.name?.getText()}_${methodName}`);
      this.addNode({
        id: dynamicConfigId,
        type: 'DynamicModuleConfig',
        name: `${node.name?.getText()}.${methodName}`,
        properties: {
          methodName,
          returnType: method.type?.getText() || 'DynamicModule',
          parameters: method.parameters.map((param) => ({
            name: param.name.getText(),
            type: param.type?.getText(),
          })),
        },
      });

      // Add relationship between module and its dynamic configuration
      this.addRelationship({
        from: moduleId,
        to: dynamicConfigId,
        type: 'HAS_DYNAMIC_CONFIG',
        properties: {
          method: methodName,
        },
      });

      // Process the method body to extract dynamic imports and providers if possible
      if (method.body) {
        this.processDynamicModuleBody(method.body, moduleId, dynamicConfigId);
      }
    });
  }

  private processDynamicModuleBody(body: ts.Block | ts.Expression, moduleId: string, configId: string): void {
    // Find the return statement that returns the DynamicModule
    const returnStatement = this.findDynamicModuleReturn(body);
    if (!returnStatement || !ts.isObjectLiteralExpression(returnStatement)) return;

    const dynamicMetadata = this.extractDynamicModuleMetadata(returnStatement);
    if (!dynamicMetadata) return;

    // Process the dynamic module configuration
    this.processModule(dynamicMetadata, moduleId, dynamicMetadata.module?.toString() || moduleId, true);

    // Update the dynamic config node with the extracted metadata
    const configNode = this.nodes.get(configId);
    if (configNode) {
      configNode.properties = {
        ...configNode.properties,
        dynamicImports: dynamicMetadata.imports || [],
        dynamicProviders: dynamicMetadata.providers || [],
        dynamicExports: dynamicMetadata.exports || [],
      };
    }
  }

  private findDynamicModuleReturn(node: ts.Node): ts.Expression | undefined {
    if (ts.isReturnStatement(node) && node.expression) {
      return node.expression;
    }

    let result: ts.Expression | undefined;
    node.forEachChild((child) => {
      if (!result) {
        result = this.findDynamicModuleReturn(child);
      }
    });

    return result;
  }

  private extractDynamicModuleMetadata(returnExpr: ts.ObjectLiteralExpression): any {
    const metadata: any = {};

    returnExpr.properties.forEach((prop) => {
      if (!ts.isPropertyAssignment(prop)) return;

      const propName = prop.name.getText();
      const value = prop.initializer;

      if (ts.isArrayLiteralExpression(value)) {
        metadata[propName] = value.elements.map((element) => element.getText());
      } else {
        metadata[propName] = value.getText();
      }
    });

    return metadata;
  }

  private processModule(moduleMetadata: any, moduleId: string, className: string, isDynamic: boolean = false) {
    // Añadir nodo del módulo
    this.addNode({
      id: moduleId,
      type: 'Module',
      name: className,
      properties: {
        imports: moduleMetadata.imports || [],
        exports: moduleMetadata.exports || [],
        providers: moduleMetadata.providers || [],
        controllers: moduleMetadata.controllers || [],
        isGlobal: Boolean(moduleMetadata.global),
        isDynamic,
        level: className === 'AppModule' ? 1 : 2,
      },
    });

    // Procesar providers
    (moduleMetadata.providers || []).forEach((provider: any) => {
      let providerName = '';
      let providerId = '';

      // Manejar diferentes formatos de providers
      if (typeof provider === 'string') {
        providerName = provider;
        providerId = this.generateId('provider', providerName);
      } else if (typeof provider === 'function') {
        providerName = provider.name;
        providerId = this.generateId('provider', providerName);
      } else if (provider && typeof provider === 'object') {
        // Caso de provider con provide/useClass/useFactory/useValue
        providerName = provider.provide?.toString() || 'UnknownProvider';
        providerId = this.generateId('provider', providerName);
      }

      this.addNode({
        id: providerId,
        type: 'Provider',
        name: providerName,
        properties: {
          scope: 'module',
          level: 3,
          isInjectable: true,
        },
      });

      this.addRelationship({
        from: moduleId,
        to: providerId,
        type: 'PROVIDES',
      });
    });

    // Procesar controllers
    (moduleMetadata.controllers || []).forEach((controller: any) => {
      const controllerName = controller.toString();
      const controllerId = this.generateId('controller', controllerName);

      this.addNode({
        id: controllerId,
        type: 'Controller',
        name: controllerName,
        properties: {
          level: 3,
        },
      });

      this.addRelationship({
        from: moduleId,
        to: controllerId,
        type: 'DECLARES_CONTROLLER',
      });
    });

    // Procesar imports
    (moduleMetadata.imports || []).forEach((imported: any) => {
      const importedName = imported.toString().split('(')[0].trim(); // Eliminar parámetros de forRoot/forFeature
      const importedId = this.generateId('module', importedName);

      this.addRelationship({
        from: moduleId,
        to: importedId,
        type: 'IMPORTS',
      });
    });

    // Procesar exports
    (moduleMetadata.exports || []).forEach((exported: any) => {
      const exportedName = exported.toString();
      const exportedId = this.generateId('provider', exportedName);

      this.addRelationship({
        from: moduleId,
        to: exportedId,
        type: 'EXPORTS',
      });
    });
  }

  private processHeritageClauses(
    node: ts.Node & { heritageClauses?: ts.NodeArray<ts.HeritageClause> },
    nodeId: string,
    nodeType: 'class' | 'interface',
  ): void {
    if (!node.heritageClauses) return;

    node.heritageClauses.forEach((clause) => {
      const isExtends = clause.token === ts.SyntaxKind.ExtendsKeyword;
      const isImplements = clause.token === ts.SyntaxKind.ImplementsKeyword;

      clause.types.forEach((type) => {
        const baseTypeName = type.expression.getText();
        // Determinar si el tipo base es una clase o interfaz basado en el contexto
        const baseNodeType = isImplements ? 'interface' : nodeType;
        const baseTypeId = this.generateId(baseNodeType, baseTypeName);

        // Asegurarse de que el nodo base exista
        if (!this.nodes.has(baseTypeId)) {
          this.addNode({
            id: baseTypeId,
            type: baseNodeType === 'class' ? 'Class' : 'Interface',
            name: baseTypeName,
            properties: {
              level: 5,
              isExternal: true, // Marcar como externo si no fue encontrado en el análisis
            },
          });
        }

        // Añadir la relación con propiedades adicionales
        this.addRelationship({
          from: nodeId,
          to: baseTypeId,
          type: isExtends ? 'EXTENDS' : 'IMPLEMENTS',
          properties: {
            sourceType: nodeType,
            targetType: baseNodeType,
            typeArguments: type.typeArguments?.map((arg) => arg.getText()) || [],
          },
        });
      });
    });
  }

  private processClass(node: ts.ClassDeclaration): void {
    if (!node.name) return;

    const className = node.name.getText();
    const decorators = ts.canHaveDecorators(node) ? ts.getDecorators(node) : undefined;
    const classId = this.generateId('class', className);
    const extractedDecorators = this.extractDecorators(node);
    const isInjectable = extractedDecorators.some((d) => d.name === 'Injectable');

    this.addNode({
      id: classId,
      type: 'Class',
      name: className,
      properties: {
        isAbstract: node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AbstractKeyword) || false,
        documentation: this.getDocumentation(node),
        isInjectable,
        level: isInjectable ? 4 : 5,
      },
      decorators: extractedDecorators,
    });

    this.processConstructorInjections(node, classId);
    this.processHeritageClauses(node, classId, 'class');
  }

  private processConstructorInjections(node: ts.ClassDeclaration, classId: string): void {
    const constructor = node.members.find((member) => ts.isConstructorDeclaration(member)) as
      | ts.ConstructorDeclaration
      | undefined;

    if (!constructor) return;

    constructor.parameters.forEach((param) => {
      const paramDecorators = this.extractDecorators(param);
      const paramType = param.type ? param.type.getText() : undefined;

      if (!paramType) return;

      // Limpiar el tipo de parámetro (remover genéricos y espacios)
      const cleanParamType = paramType.split('<')[0].trim();
      const injectedServiceId = this.generateId('provider', cleanParamType);
      const paramName = param.name.getText();

      // Crear el nodo del servicio inyectado si no existe
      if (!this.nodes.has(injectedServiceId)) {
        this.addNode({
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

      // Crear la relación de inyección
      this.addRelationship({
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

  private processInterface(node: ts.InterfaceDeclaration): void {
    if (!node.name) return;

    const interfaceName = node.name.getText();
    const interfaceId = this.generateId('interface', interfaceName);

    this.addNode({
      id: interfaceId,
      type: 'Interface',
      name: interfaceName,
      properties: {
        documentation: this.getDocumentation(node),
        level: 5,
      },
    });

    this.processHeritageClauses(node, interfaceId, 'interface');
  }

  private processMethod(node: ts.MethodDeclaration): void {
    if (!node.name) return;

    const methodName = node.name.getText();
    const parentClass = this.findParentClass(node);
    if (!parentClass || !parentClass.name) return;

    const methodId = this.generateId('method', `${parentClass.name.getText()}.${methodName}`);
    const classId = this.generateId('class', parentClass.name.getText());
    const extractedDecorators = this.extractDecorators(node);

    this.addNode({
      id: methodId,
      type: 'Method',
      name: methodName,
      properties: {
        returnType: node.type ? node.type.getText() : 'void',
        visibility: this.getVisibility(node),
        documentation: this.getDocumentation(node),
      },
      decorators: extractedDecorators,
    });

    this.addRelationship({
      from: classId,
      to: methodId,
      type: 'HAS_METHOD',
    });
  }

  private processProperty(node: ts.PropertyDeclaration): void {
    if (!node.name) return;

    const propertyName = node.name.getText();
    const parentClass = this.findParentClass(node);

    if (!parentClass || !parentClass.name) return;

    const propertyId = this.generateId('property', `${parentClass.name.getText()}.${propertyName}`);
    const classId = this.generateId('class', parentClass.name.getText());

    this.addNode({
      id: propertyId,
      type: 'Property',
      name: propertyName,
      properties: {
        type: node.type ? node.type.getText() : 'any',
        visibility: this.getVisibility(node),
      },
      decorators: this.extractDecorators(node),
    });

    this.addRelationship({
      from: classId,
      to: propertyId,
      type: 'HAS_PROPERTY',
    });
  }

  private processEnum(node: ts.EnumDeclaration): void {
    if (!node.name) return;

    const enumName = node.name.getText();
    const enumId = this.generateId('enum', enumName);

    this.addNode({
      id: enumId,
      type: 'Enum',
      name: enumName,
      properties: {
        documentation: this.getDocumentation(node),
        level: 5,
      },
    });
  }

  private generateId(type: string, name: string): string {
    return `${type}_${name}`;
  }

  private addNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
  }

  private addRelationship(relationship: GraphRelationship): void {
    this.relationships.push(relationship);
  }

  /**
   * Obtiene la documentación JSDoc de un nodo
   */
  private getDocumentation(node: ts.Node): string {
    const sourceFile = node.getSourceFile();
    const nodePos = node.getStart();
    const commentRanges = ts.getLeadingCommentRanges(sourceFile.text, nodePos);

    if (!commentRanges || commentRanges.length === 0) return '';

    return commentRanges
      .filter((range) => sourceFile.text.substring(range.pos, range.pos + 2) === '/*')
      .map((range) => sourceFile.text.substring(range.pos, range.end))
      .join('\n');
  }

  /**
   * Determina la visibilidad de un nodo
   */
  private getVisibility(node: ts.Node & { modifiers?: ts.NodeArray<ts.ModifierLike> }): string {
    if (!node.modifiers) return 'public';

    if (node.modifiers.some((m: ts.ModifierLike) => m.kind === ts.SyntaxKind.PrivateKeyword)) return 'private';
    if (node.modifiers.some((m: ts.ModifierLike) => m.kind === ts.SyntaxKind.ProtectedKeyword)) return 'protected';
    return 'public';
  }

  private findParentClass(node: ts.Node): ts.ClassDeclaration | undefined {
    let current = node.parent;
    while (current) {
      if (ts.isClassDeclaration(current)) {
        return current;
      }
      current = current.parent;
    }
    return undefined;
  }

  private extractDecorators(node: ts.Node): Array<{ name: string; arguments?: any[] }> {
    const decorators = ts.canHaveDecorators(node) ? ts.getDecorators(node) : undefined;
    if (!decorators) {
      return [];
    }

    return decorators
      .map((decorator) => {
        try {
          if (ts.isCallExpression(decorator.expression)) {
            // Extraer el nombre real del decorador
            let decoratorName = decorator.expression.expression.getText();
            // Limpiar el nombre (quitar @)
            decoratorName = decoratorName.replace('@', '');

            const args = decorator.expression.arguments.map((arg) => {
              // Manejar específicamente objetos de configuración de módulos
              if (ts.isObjectLiteralExpression(arg)) {
                const config: any = {};
                arg.properties.forEach((prop) => {
                  if (ts.isPropertyAssignment(prop)) {
                    const propName = prop.name.getText();
                    if (ts.isArrayLiteralExpression(prop.initializer)) {
                      config[propName] = prop.initializer.elements.map((e) => e.getText());
                    } else {
                      config[propName] = prop.initializer.getText();
                    }
                  }
                });
                return config;
              }

              if (ts.isStringLiteral(arg)) {
                return arg.text;
              }
              if (ts.isNumericLiteral(arg)) {
                return Number(arg.text);
              }
              return arg.getText();
            });

            return {
              name: decoratorName,
              arguments: args,
            };
          } else {
            return {
              name: decorator.expression.getText().replace('@', ''),
            };
          }
        } catch (error: any) {
          console.error(`Error processing decorator:`, error);
          return {
            name: 'unknown_decorator',
            error: error?.message || 'Error desconocido',
          };
        }
      })
      .filter((dec) => dec.name !== 'unknown_decorator');
  }
}
