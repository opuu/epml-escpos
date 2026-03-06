import { EPMLPlugin, CommandMap } from "./plugin.js";
import { EPMLWarning } from "./errors.js";

const isObject = (item: any) =>
  item &&
  typeof item === "object" &&
  !Array.isArray(item) &&
  !(item instanceof Uint8Array);

function mergeDeep(
  target: any,
  source: any,
  onConflict?: (path: string, val1: any, val2: any) => void,
  basePath = "",
) {
  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        mergeDeep(
          target[key],
          source[key],
          onConflict,
          basePath ? `${basePath}.${key}` : key,
        );
      } else {
        if (
          onConflict &&
          target[key] !== undefined &&
          source[key] !== undefined
        ) {
          onConflict(
            basePath ? `${basePath}.${key}` : key,
            target[key],
            source[key],
          );
        }
        Object.assign(target, { [key]: source[key] });
      }
    }
  }
  return target;
}

export class PluginRegistry {
  private static globalPlugins: EPMLPlugin[] = [];

  public static register(plugin: EPMLPlugin): void {
    const existingIdx = this.globalPlugins.findIndex(
      (p) => p.name === plugin.name,
    );
    if (existingIdx >= 0) {
      this.globalPlugins[existingIdx] = plugin;
    } else {
      this.globalPlugins.push(plugin);
    }
  }

  public static unregister(pluginName: string): void {
    this.globalPlugins = this.globalPlugins.filter(
      (p) => p.name !== pluginName,
    );
  }

  public static getRegisteredPlugins(): string[] {
    return this.globalPlugins.map((p) => p.name);
  }

  public static compileCommandMap(
    baseMap: CommandMap,
    localPlugins: EPMLPlugin[] = [],
    warningsOut: EPMLWarning[],
  ): CommandMap {
    // Clone base map
    const mergedMap = JSON.parse(
      JSON.stringify(baseMap, (key, value) => {
        // Uint8Array JSON fix natively bypassing functions
        if (value instanceof Uint8Array) {
          return { type: "Buffer", data: Array.from(value) };
        }
        return value;
      }),
    );

    // Functions are lost in JSON stringify so we use a custom deep clone for the map structure
    const cloneCommandMap = (source: any): any => {
      if (source === null) return null;
      if (source instanceof Uint8Array) return new Uint8Array(source);
      if (typeof source === "function") return source;
      if (typeof source === "object") {
        const copy: any = {};
        for (const key in source) {
          copy[key] = cloneCommandMap(source[key]);
        }
        return copy;
      }
      return source;
    };

    const finalMap = cloneCommandMap(baseMap) as CommandMap;
    const allPlugins = [...this.globalPlugins, ...localPlugins];

    for (const plugin of allPlugins) {
      if (plugin.version !== 1) {
        throw new Error(
          `Plugin '${plugin.name}' requires unsupported version ${plugin.version}. Supported versions: 1`,
        ); // Captured upstream
      }

      mergeDeep(finalMap, plugin.commands, (path, val1, val2) => {
        // On strict conflict (different explicit non-null objects resolving down to leaves) we emit a warning
        if (val1 !== val2 && val1 != null && val2 != null) {
          warningsOut.push({
            message: `Plugin conflict on CommandMap key '${path}'. Winning plugin: ${plugin.name}`,
            stage: "plugin",
          });
        }

        // Warn if a plugin explicitly nullifies an existing capability
        if (val1 != null && val2 === null) {
          warningsOut.push({
            message: `Plugin '${plugin.name}' explicitly nullified CommandMap key '${path}'`,
            stage: "plugin",
          });
        }
      });
    }

    return finalMap;
  }
}
