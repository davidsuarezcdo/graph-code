import ts from 'typescript';
import * as path from 'path';
import { GraphNode, GraphRelationship } from '../../shared/types/graph.types';
import { GraphData } from '../types/graph.types';
import { ClassProcessor } from '../processors/ClassProcessor';
import { ModuleProcessor } from '../processors/ModuleProcessor';
import { InterfaceProcessor } from '../processors/InterfaceProcessor';
import { DecoratorProcessor } from '../processors/DecoratorProcessor';

export class TypeScriptGraphBuilder {
  private nodes: Map<string, GraphNode> = new Map();
  private relationships: Map<string, GraphRelationship> = new Map();
  private typeChecker: ts.TypeChecker | undefined;
  private processors: {
    classProcessor: ClassProcessor;
    moduleProcessor: ModuleProcessor;
    interfaceProcessor: InterfaceProcessor;
    decoratorProcessor: DecoratorProcessor;
  };
  private methodNameIndex: Map<string, string> = new Map();
  private projectBaseName: string;

  constructor(projectBaseName?: string) {
    this.projectBaseName = projectBaseName || '';
    this.processors = {
      classProcessor: new ClassProcessor(this),
      moduleProcessor: new ModuleProcessor(this),
      interfaceProcessor: new InterfaceProcessor(this),
      decoratorProcessor: new DecoratorProcessor(this),
    };
  }

  /**
   * Convierte una ruta absoluta a relativa basada en el nombre del proyecto
   */
  public getRelativePath(absolutePath: string): string {
    if (!this.projectBaseName || !absolutePath) {
      return absolutePath;
    }

    const parts = absolutePath.split(this.projectBaseName);
    if (parts.length > 1) {
      // Tomar la parte después del nombre base y eliminar el separador inicial
      return parts[parts.length - 1].replace(/^[\/\\]/, '');
    }
    return absolutePath;
  }

  public async buildGraph(rootPath: string): Promise<GraphData> {
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
        // Almacenar ruta relativa del archivo en lugar de la absoluta
        const filePath = sourceFile.fileName;
        const relativePath = this.getRelativePath(filePath);

        // Añadir información de archivo al contexto de visita
        this.visitNode(sourceFile, { filePath: relativePath });
      }
    }

    return {
      nodes: Array.from(this.nodes.values()),
      relationships: Array.from(this.relationships.values()),
    };
  }

  private visitNode(node: ts.Node, context?: { filePath: string }): void {
    switch (node.kind) {
      case ts.SyntaxKind.ClassDeclaration:
        this.processors.classProcessor.process(node as ts.ClassDeclaration, context);
        break;
      case ts.SyntaxKind.InterfaceDeclaration:
        this.processors.interfaceProcessor.process(node as ts.InterfaceDeclaration, context);
        break;
    }

    // Process decorators if present
    if (ts.isClassDeclaration(node)) {
      this.processors.moduleProcessor.process(node, context);
      this.processors.decoratorProcessor.process(node, context);
    }

    ts.forEachChild(node, (child) => this.visitNode(child, context));
  }

  public addNode(node: GraphNode): void {
    // Si el nodo tiene propiedades de archivo, asegurarse de que use la ruta relativa
    if (node.properties?.filepath && typeof node.properties.filepath === 'string') {
      node.properties.filepath = this.getRelativePath(node.properties.filepath);
    }

    this.nodes.set(node.id, node);
    if (node.type === 'Method') {
      this.methodNameIndex.set(node.name, node.id);
    }
  }

  public findMethodByName(methodName: string): string | undefined {
    return this.methodNameIndex.get(methodName);
  }

  public updateMethodCallCount(methodId: string): void {
    const node = this.nodes.get(methodId);
    if (node && node.type === 'Method') {
      node.properties = node.properties || {};
      node.properties.callCount = (node.properties.callCount || 0) + 1;
    }
  }

  public hasNode(id: string): boolean {
    return this.nodes.has(id);
  }

  public getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  public addRelationship(relationship: GraphRelationship): void {
    const id = `${relationship.from}_${relationship.type}_${relationship.to}`;

    if (relationship.type === 'CALLS') {
      const existingRel = this.relationships.get(id);
      if (existingRel) {
        existingRel.properties = existingRel.properties || {};
        existingRel.properties.callCount = (existingRel.properties.callCount || 0) + 1;
        this.updateMethodCallCount(relationship.to);
        return;
      }
    }

    this.relationships.set(id, relationship);
  }

  public getTypeChecker(): ts.TypeChecker | undefined {
    return this.typeChecker;
  }

  public hasRelationship(fromId: string, toId: string, type: string): boolean {
    const relationship = this.relationships.get(`${fromId}_${type}_${toId}`);
    return !!relationship;
  }
}
