import ts from 'typescript';
import * as path from 'path';
import { GraphData, GraphNode, GraphRelationship } from '../types/graph.types';
import { ClassProcessor } from '../processors/ClassProcessor';
import { ModuleProcessor } from '../processors/ModuleProcessor';
import { InterfaceProcessor } from '../processors/InterfaceProcessor';
import { DecoratorProcessor } from '../processors/DecoratorProcessor';

export class TypeScriptGraphBuilder {
  private nodes: Map<string, GraphNode> = new Map();
  private relationships: GraphRelationship[] = [];
  private typeChecker: ts.TypeChecker | undefined;
  private processors: {
    classProcessor: ClassProcessor;
    moduleProcessor: ModuleProcessor;
    interfaceProcessor: InterfaceProcessor;
    decoratorProcessor: DecoratorProcessor;
  };

  constructor() {
    this.processors = {
      classProcessor: new ClassProcessor(this),
      moduleProcessor: new ModuleProcessor(this),
      interfaceProcessor: new InterfaceProcessor(this),
      decoratorProcessor: new DecoratorProcessor(this),
    };
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
        this.processors.classProcessor.process(node as ts.ClassDeclaration);
        break;
      case ts.SyntaxKind.InterfaceDeclaration:
        this.processors.interfaceProcessor.process(node as ts.InterfaceDeclaration);
        break;
    }

    // Process decorators if present
    if (ts.isClassDeclaration(node)) {
      this.processors.moduleProcessor.process(node);
      this.processors.decoratorProcessor.process(node);
    }

    ts.forEachChild(node, (child) => this.visitNode(child));
  }

  public addNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
  }

  public addRelationship(relationship: GraphRelationship): void {
    this.relationships.push(relationship);
  }

  public getTypeChecker(): ts.TypeChecker | undefined {
    return this.typeChecker;
  }

  public hasNode(id: string): boolean {
    return this.nodes.has(id);
  }

  public getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  public hasRelationship(fromId: string, toId: string, type: string): boolean {
    return this.relationships.some((rel) => rel.from === fromId && rel.to === toId && rel.type === type);
  }
}
