import ts from 'typescript';
import { TypeScriptGraphBuilder } from '../core/TypeScriptGraphBuilder';
import { DecoratorProcessor } from '../processors/DecoratorProcessor';
import { generateId, getDocumentation, getVisibility, getNodePosition } from '../utils/nodeUtils';
import { FileContext } from '../processors/BaseProcessor';

export class PropertyAnalyzer {
  private builder: TypeScriptGraphBuilder;
  private decoratorProcessor: DecoratorProcessor;

  constructor(builder: TypeScriptGraphBuilder) {
    this.builder = builder;
    this.decoratorProcessor = new DecoratorProcessor(builder);
  }

  public analyzeClassProperty(
    node: ts.PropertyDeclaration,
    parentId: string,
    parentName: string,
    context?: FileContext,
  ): void {
    if (!node.name) return;

    const propertyName = node.name.getText().split('(')[0].trim();
    const propertyId = generateId('property', `${parentId}.${propertyName}`);
    const visibility = getVisibility(node);
    const type = node.type ? this.getTypeNameFromTypeNode(node.type) : 'any';
    const isReadonly = node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.ReadonlyKeyword) || false;
    const isStatic = node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.StaticKeyword) || false;
    const extractedDecorators = this.decoratorProcessor.extractDecorators(node);
    const position = getNodePosition(node);

    if (!this.builder.hasNode(propertyId)) {
      this.builder.addNode({
        id: propertyId,
        type: 'Property',
        name: propertyName,
        properties: {
          type,
          visibility,
          level: 5,
          isStatic,
          isReadonly,
          documentation: getDocumentation(node),
          sourceClassName: parentName,
          filepath: context?.filePath ? `${context.filePath}:${position.startLine}:${position.endLine}` : undefined,
        },
        decorators: extractedDecorators,
      });

      this.builder.addRelationship({
        from: parentId,
        to: propertyId,
        type: 'HAS_PROPERTY',
      });
    }
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
}
