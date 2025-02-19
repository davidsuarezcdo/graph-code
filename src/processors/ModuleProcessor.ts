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
      let providerClass = null;

      if (typeof provider === 'string') {
        providerName = provider;
      } else if (typeof provider === 'function') {
        providerName = provider.name;
        providerClass = provider;
      } else if (provider && typeof provider === 'object') {
        if (provider.useClass) {
          providerName = provider.useClass.name;
          providerClass = provider.useClass;
        } else if (provider.provide) {
          providerName = provider.provide.toString();
          if (typeof provider.useValue === 'function') {
            providerClass = provider.useValue;
          }
        } else {
          providerName = 'UnknownProvider_' + Math.random().toString(36).substr(2, 9);
        }
        providerName = providerName.split('<')[0].trim();
      }

      const providerId = this.generateId('provider', providerName);

      if (!this.builder.hasNode(providerId)) {
        this.builder.addNode({
          id: providerId,
          type: 'Provider',
          name: providerName,
          properties: {
            scope: 'module',
            level: 3,
            isInjectable: true,
            isUnknown: providerName.startsWith('UnknownProvider_'),
          },
        });
      }

      this.builder.addRelationship({
        from: moduleId,
        to: providerId,
        type: 'PROVIDES',
      });

      if (providerClass && typeof providerClass === 'function' && providerClass.prototype) {
        this.processProviderMethods(providerClass, providerId);
      }
    });
  }

  private processProviderMethods(providerClass: Function, providerId: string): void {
    const prototype = providerClass.prototype;
    const methodNames = Object.getOwnPropertyNames(prototype).filter(
      (name) => name !== 'constructor' && typeof prototype[name] === 'function',
    );

    methodNames.forEach((methodName) => {
      const cleanMethodName = methodName.split('(')[0].trim();
      const methodId = this.generateId('method', `${providerId}.${cleanMethodName}`);

      if (!this.builder.hasNode(methodId)) {
        const method = prototype[methodName];
        const methodInfo = {
          id: methodId,
          type: 'Method',
          name: cleanMethodName,
          properties: {
            visibility: 'public',
            level: 4,
            returnType: 'unknown',
            isAsync: method.constructor.name === 'AsyncFunction',
          },
        };

        this.builder.addNode(methodInfo);
        this.builder.addRelationship({
          from: providerId,
          to: methodId,
          type: 'HAS_METHOD',
        });
      }
    });
  }

  private processControllers(controllers: any[], moduleId: string): void {
    controllers.forEach((controller) => {
      let controllerName = '';
      let controllerClass = null;

      if (typeof controller === 'string') {
        controllerName = controller;
      } else if (typeof controller === 'function') {
        controllerName = controller.name;
        controllerClass = controller;
      } else if (controller && typeof controller === 'object') {
        controllerName = controller.toString().split('(')[0].trim();
        if (typeof controller === 'function') {
          controllerClass = controller;
        }
      }

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

      if (controllerClass && typeof controllerClass === 'function' && controllerClass.prototype) {
        this.processControllerMethods(controllerClass, controllerId);
      }
    });
  }

  private processControllerMethods(controllerClass: Function, controllerId: string): void {
    const prototype = controllerClass.prototype;
    const methodNames = Object.getOwnPropertyNames(prototype).filter(
      (name) => name !== 'constructor' && typeof prototype[name] === 'function',
    );

    methodNames.forEach((methodName) => {
      const cleanMethodName = methodName.split('(')[0].trim();
      const methodId = this.generateId('method', `${controllerId}.${cleanMethodName}`);

      if (!this.builder.hasNode(methodId)) {
        const method = prototype[methodName];
        const methodInfo = {
          id: methodId,
          type: 'Method',
          name: cleanMethodName,
          properties: {
            visibility: 'public',
            level: 4,
            returnType: 'unknown',
            isAsync: method.constructor.name === 'AsyncFunction',
            isEndpoint: true,
          },
        };

        this.builder.addNode(methodInfo);
        this.builder.addRelationship({
          from: controllerId,
          to: methodId,
          type: 'HAS_METHOD',
        });
      }
    });
  }

  private processImports(imports: any[], moduleId: string): void {
    imports.forEach((imported) => {
      let importedName = '';

      if (typeof imported === 'string') {
        importedName = imported;
      } else if (typeof imported === 'function') {
        importedName = imported.name;
      } else if (imported && typeof imported === 'object') {
        importedName = (imported.module?.toString() || imported.toString()).split('(')[0].trim();
      }

      const importedId = this.generateId('module', importedName);

      if (!this.builder.hasNode(importedId)) {
        this.builder.addNode({
          id: importedId,
          type: 'Module',
          name: importedName,
          properties: {
            level: 2,
            isExternal: true,
          },
        });
      }

      this.builder.addRelationship({
        from: moduleId,
        to: importedId,
        type: 'IMPORTS',
      });
    });
  }

  private processExports(exports: any[], moduleId: string): void {
    exports.forEach((exported) => {
      let exportedName = '';
      let exportedId = '';

      if (typeof exported === 'string') {
        exportedName = exported;
      } else if (typeof exported === 'function') {
        exportedName = exported.name;
      } else if (exported && typeof exported === 'object') {
        exportedName = (exported.provide?.toString() || exported.useClass?.name || exported.toString())
          .split('<')[0]
          .trim();
      }

      exportedId = this.generateId('provider', exportedName);

      if (!this.builder.hasNode(exportedId)) {
        const controllerId = this.generateId('controller', exportedName);
        if (this.builder.hasNode(controllerId)) {
          exportedId = controllerId;
        } else {
          this.builder.addNode({
            id: exportedId,
            type: 'Provider',
            name: exportedName,
            properties: {
              scope: 'module',
              level: 3,
              isInjectable: true,
              isExported: true,
            },
          });
        }
      }

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
      const methodName = method.name.getText().split('(')[0].trim();
      const methodId = this.generateId('method', `${moduleId}.${methodName}`);

      if (!this.builder.hasNode(methodId)) {
        const methodInfo = {
          id: methodId,
          type: 'Method',
          name: methodName,
          properties: {
            methodName,
            returnType: method.type?.getText() || 'DynamicModule',
            isDynamic: true,
            isStatic: true,
            level: 4,
            parameters: method.parameters.map((param) => ({
              name: param.name.getText().split('(')[0].trim(),
              type: param.type?.getText(),
            })),
          },
          decorators: this.decoratorProcessor.extractDecorators(method),
        };

        this.builder.addNode(methodInfo);

        this.builder.addRelationship({
          from: moduleId,
          to: methodId,
          type: 'HAS_DYNAMIC_CONFIG',
          properties: {
            method: methodName,
          },
        });
      }
    });
  }
}
