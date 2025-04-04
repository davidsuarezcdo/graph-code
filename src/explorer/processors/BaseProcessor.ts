import ts from 'typescript';
import { TypeScriptGraphBuilder } from '../core/TypeScriptGraphBuilder';
import { generateId, getDocumentation, getVisibility } from '../utils/nodeUtils';

export interface FileContext {
  filePath?: string;
}

export abstract class BaseProcessor {
  protected builder: TypeScriptGraphBuilder;

  constructor(builder: TypeScriptGraphBuilder) {
    this.builder = builder;
  }

  protected generateId(type: string, name: string): string {
    return generateId(type, name);
  }

  protected getDocumentation(node: ts.Node): string {
    return getDocumentation(node);
  }

  protected getVisibility(node: ts.Node & { modifiers?: ts.NodeArray<ts.ModifierLike> }): string {
    return getVisibility(node);
  }

  protected findParentClass(node: ts.Node): ts.ClassDeclaration | undefined {
    let current = node.parent;
    while (current) {
      if (ts.isClassDeclaration(current)) {
        return current;
      }
      current = current.parent;
    }
    return undefined;
  }

  abstract process(node: ts.Node, context?: FileContext): void;
}
