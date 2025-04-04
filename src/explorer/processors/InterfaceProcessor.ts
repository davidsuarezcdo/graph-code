import ts from 'typescript';
import { BaseProcessor, FileContext } from './BaseProcessor';
import { NodeLevel } from '../constants/NodeLevels';
import { getNodePosition } from '../utils/nodeUtils';

export class InterfaceProcessor extends BaseProcessor {
  public process(node: ts.InterfaceDeclaration, context?: FileContext): void {
    if (!node.name) return;

    const interfaceName = node.name.getText();
    const interfaceId = this.generateId('interface', interfaceName);
    const position = getNodePosition(node);

    this.builder.addNode({
      id: interfaceId,
      type: 'Interface',
      name: interfaceName,
      properties: {
        documentation: this.getDocumentation(node),
        level: 5,
        filepath: context?.filePath ? `${context.filePath}:${position.startLine}:${position.endLine}` : undefined,
      },
    });

    this.processHeritageClauses(node, interfaceId);
  }

  private processHeritageClauses(node: ts.InterfaceDeclaration, nodeId: string): void {
    if (!node.heritageClauses) return;

    node.heritageClauses.forEach((clause) => {
      clause.types.forEach((type) => {
        const baseTypeName = type.expression.getText();
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
          type: 'EXTENDS',
          properties: {
            sourceType: 'interface',
            targetType: 'interface',
            typeArguments: type.typeArguments?.map((arg) => arg.getText()) || [],
          },
        });
      });
    });
  }
}
