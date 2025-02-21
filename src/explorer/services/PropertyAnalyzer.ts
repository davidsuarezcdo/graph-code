import ts from 'typescript';
import { TypeScriptGraphBuilder } from '../core/TypeScriptGraphBuilder';
import { DecoratorProcessor } from '../processors/DecoratorProcessor';
import { generateId, getDocumentation, getVisibility } from '../utils/nodeUtils';

export class PropertyAnalyzer {
  private builder: TypeScriptGraphBuilder;
  private decoratorProcessor: DecoratorProcessor;

  constructor(builder: TypeScriptGraphBuilder) {
    this.builder = builder;
    this.decoratorProcessor = new DecoratorProcessor(builder);
  }

  public analyzeClassProperty(node: ts.PropertyDeclaration, parentId: string, parentName: string): void {
    if (!node.name) return;

    const propertyName = node.name.getText().split('(')[0].trim();
    const propertyId = generateId('property', `${parentId}.${propertyName}`);
    const extractedDecorators = this.decoratorProcessor.extractDecorators(node);
    const propertyType = node.type ? this.getTypeNameFromTypeNode(node.type) : 'any';

    if (!this.builder.hasNode(propertyId)) {
      this.builder.addNode({
        id: propertyId,
        type: 'Property',
        name: propertyName,
        properties: {
          type: propertyType,
          visibility: getVisibility(node),
          level: 5,
          isStatic: node.modifiers?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword) || false,
          isReadonly: node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ReadonlyKeyword) || false,
          documentation: getDocumentation(node),
          sourceClassName: parentName,
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
