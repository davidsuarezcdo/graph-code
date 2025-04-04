import ts from 'typescript';

/**
 * Genera un identificador único para un nodo
 */
export function generateId(type: string, name: string): string {
  return `${type.toLowerCase()}_${name}`;
}

/**
 * Obtiene la documentación de un nodo desde sus comentarios JSDoc
 */
export function getDocumentation(node: ts.Node): string {
  const sourceFile = node.getSourceFile();
  if (!sourceFile) return '';

  const nodePos = node.getStart();
  const commentRanges = ts.getLeadingCommentRanges(sourceFile.text, nodePos);

  if (!commentRanges || commentRanges.length === 0) return '';

  return commentRanges
    .filter((range) => sourceFile.text.substring(range.pos, range.pos + 2) === '/*')
    .map((range) => sourceFile.text.substring(range.pos, range.end))
    .join('\n')
    .replace(/\/\*\*|\*\/|\*/g, '')
    .trim();
}

/**
 * Determina la visibilidad de un nodo basándose en sus modificadores
 */
export function getVisibility(node: ts.Node & { modifiers?: ts.NodeArray<ts.ModifierLike> }): string {
  if (!node.modifiers) return 'public';

  if (node.modifiers.some((mod) => mod.kind === ts.SyntaxKind.PrivateKeyword)) {
    return 'private';
  } else if (node.modifiers.some((mod) => mod.kind === ts.SyntaxKind.ProtectedKeyword)) {
    return 'protected';
  } else {
    return 'public';
  }
}

/**
 * Obtiene información de posición de un nodo en el archivo fuente
 * Devuelve tanto la línea de inicio como la de fin
 */
export function getNodePosition(node: ts.Node): { startLine: number; endLine: number } {
  if (!node || !node.getSourceFile()) {
    return { startLine: -1, endLine: -1 };
  }

  const sourceFile = node.getSourceFile();
  const start = node.getStart();
  const end = node.getEnd();

  const { line: startLine } = ts.getLineAndCharacterOfPosition(sourceFile, start);
  const { line: endLine } = ts.getLineAndCharacterOfPosition(sourceFile, end);

  // Las líneas en TS empiezan en 0, sumamos 1 para obtener el número de línea real
  return {
    startLine: startLine + 1,
    endLine: endLine + 1,
  };
}

/**
 * Obtiene el número de línea de un nodo en el archivo fuente
 * @deprecated Esta función está obsoleta y será eliminada en futuras versiones.
 * Use getNodePosition() en su lugar para obtener inicio y fin de línea.
 */
export function getLineNumber(node: ts.Node): number {
  if (!node || !node.getSourceFile()) {
    return -1;
  }

  const sourceFile = node.getSourceFile();
  const { line } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart());

  // Las líneas en TS empiezan en 0, sumamos 1 para obtener el número de línea real
  return line + 1;
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
