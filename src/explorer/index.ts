import { TypeScriptGraphBuilder } from './core/TypeScriptGraphBuilder';

export async function exploreTypeScript(rootPath: string) {
  const builder = new TypeScriptGraphBuilder();
  return await builder.buildGraph(rootPath);
}

export { TypeScriptGraphBuilder };
