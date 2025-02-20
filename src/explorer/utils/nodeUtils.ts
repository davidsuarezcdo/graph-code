import ts from 'typescript';

export function generateId(type: string, name: string): string {
  return `${type}_${name}`;
}

export function getDocumentation(node: ts.Node): string {
  const sourceFile = node.getSourceFile();
  const nodePos = node.getStart();
  const commentRanges = ts.getLeadingCommentRanges(sourceFile.text, nodePos);

  if (!commentRanges || commentRanges.length === 0) return '';

  return commentRanges
    .filter((range) => sourceFile.text.substring(range.pos, range.pos + 2) === '/*')
    .map((range) => sourceFile.text.substring(range.pos, range.end))
    .join('\n');
}

export function getVisibility(node: ts.Node & { modifiers?: ts.NodeArray<ts.ModifierLike> }): string {
  if (!node.modifiers) return 'public';

  if (node.modifiers.some((m: ts.ModifierLike) => m.kind === ts.SyntaxKind.PrivateKeyword)) return 'private';
  if (node.modifiers.some((m: ts.ModifierLike) => m.kind === ts.SyntaxKind.ProtectedKeyword)) return 'protected';
  return 'public';
}

export function findParentClass(node: ts.Node): ts.ClassDeclaration | undefined {
  let current = node.parent;
  while (current) {
    if (ts.isClassDeclaration(current)) {
      return current;
    }
    current = current.parent;
  }
  return undefined;
}
