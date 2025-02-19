import ts from 'typescript';
import { BaseProcessor } from './BaseProcessor';
import { DecoratorProcessor } from './DecoratorProcessor';
import { ModuleDecoratorMetadata } from '../types/decorators.types';

export class ModuleProcessor extends BaseProcessor {
  private decoratorProcessor: DecoratorProcessor;

  constructor(builder: any) {
    super(builder);
    this.decoratorProcessor = new DecoratorProcessor(builder);
  }

  public process(node: ts.ClassDeclaration): void {
    if (!node.name) return;

    const decorators = this.decoratorProcessor.extractDecorators(node);
    const moduleDecorator = decorators.find((d) => d.name === 'Module');
    const moduleId = this.generateId('module', node.name.getText());

    if (moduleDecorator && moduleDecorator.arguments?.[0]) {
      const moduleMetadata = moduleDecorator.arguments[0] as ModuleDecoratorMetadata;
      this.processModuleMetadata(moduleMetadata, moduleId, node.name.getText());
    }

    this.processDynamicModuleMethods(node, moduleId);
  }

  private processModuleMetadata(moduleMetadata: ModuleDecoratorMetadata, moduleId: string, className: string): void {
    this.builder.addNode({
      id: moduleId,
      type: 'Module',
      name: className,
      properties: {
        imports: moduleMetadata.imports || [],
        exports: moduleMetadata.exports || [],
        providers: moduleMetadata.providers || [],
        controllers: moduleMetadata.controllers || [],
        isGlobal: Boolean(moduleMetadata.global),
        level: className === 'AppModule' ? 1 : 2,
      },
    });

    this.processProviders(moduleMetadata.providers || [], moduleId);
    this.processControllers(moduleMetadata.controllers || [], moduleId);
    this.processImports(moduleMetadata.imports || [], moduleId);
    this.processExports(moduleMetadata.exports || [], moduleId);
  }

  private processProviders(providers: any[], moduleId: string): void {
    providers.forEach((provider) => {
      let providerName = '';
      let providerId = '';

      if (typeof provider === 'string') {
        providerName = provider;
        providerId = this.generateId('provider', providerName);
      } else if (typeof provider === 'function') {
        providerName = provider.name;
        providerId = this.generateId('provider', providerName);
      } else if (provider && typeof provider === 'object') {
        providerName = provider.provide?.toString() || 'UnknownProvider';
        providerId = this.generateId('provider', providerName);
      }

      this.builder.addNode({
        id: providerId,
        type: 'Provider',
        name: providerName,
        properties: {
          scope: 'module',
          level: 3,
          isInjectable: true,
        },
      });

      this.builder.addRelationship({
        from: moduleId,
        to: providerId,
        type: 'PROVIDES',
      });
    });
  }

  private processControllers(controllers: any[], moduleId: string): void {
    controllers.forEach((controller) => {
      const controllerName =
        typeof controller === 'function' ? controller.name : controller.toString().split('(')[0].trim();
      const controllerId = this.generateId('controller', controllerName);

      if (!this.builder.hasNode(controllerId)) {
        this.builder.addNode({
          id: controllerId,
          type: 'Controller',
          name: controllerName,
          properties: {
            level: 3,
          },
        });
      }

      this.builder.addRelationship({
        from: moduleId,
        to: controllerId,
        type: 'DECLARES_CONTROLLER',
      });
    });
  }

  private processImports(imports: any[], moduleId: string): void {
    imports.forEach((imported) => {
      const importedName = imported.toString().split('(')[0].trim();
      const importedId = this.generateId('module', importedName);

      this.builder.addRelationship({
        from: moduleId,
        to: importedId,
        type: 'IMPORTS',
      });
    });
  }

  private processExports(exports: any[], moduleId: string): void {
    exports.forEach((exported) => {
      const exportedName = exported.toString();
      const exportedId = this.generateId('provider', exportedName);

      this.builder.addRelationship({
        from: moduleId,
        to: exportedId,
        type: 'EXPORTS',
      });
    });
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
      const dynamicConfigId = this.generateId('dynamic_config', `${node.name?.getText()}_${methodName}`);

      this.builder.addNode({
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

      this.builder.addRelationship({
        from: moduleId,
        to: dynamicConfigId,
        type: 'HAS_DYNAMIC_CONFIG',
        properties: {
          method: methodName,
        },
      });
    });
  }
}
