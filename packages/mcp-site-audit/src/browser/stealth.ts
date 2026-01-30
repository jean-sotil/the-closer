/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Page } from "puppeteer";

import type { StealthOptions } from "./types.js";

// DOM types that exist in browser context but not in Node
declare const window: any;
declare const navigator: any;
declare const Permissions: any;
declare const Notification: any;
declare const PluginArray: any;
declare const Plugin: any;
declare const HTMLCanvasElement: any;
declare const WebGLRenderingContext: any;

/**
 * Apply stealth evasions to a page
 *
 * These help avoid detection by anti-bot systems when
 * performing legitimate website audits.
 */
export async function applyStealthEvasions(
  page: Page,
  options: StealthOptions
): Promise<void> {
  if (!options.enabled) {
    return;
  }

  const evasions = options.evasions;

  // Apply evasions before any page load
  await page.evaluateOnNewDocument(
    (evasionConfig) => {
      // 1. Hide webdriver flag
      if (evasionConfig.webdriver) {
        Object.defineProperty(navigator, "webdriver", {
          get: () => undefined,
        });

        // Also delete the property from prototype
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (Navigator as any).prototype.webdriver;
      }

      // 2. Mock chrome app
      if (evasionConfig.chromeApp) {
        window.chrome = {
          app: {
            isInstalled: false,
            InstallState: {
              DISABLED: "disabled",
              INSTALLED: "installed",
              NOT_INSTALLED: "not_installed",
            },
            RunningState: {
              CANNOT_RUN: "cannot_run",
              READY_TO_RUN: "ready_to_run",
              RUNNING: "running",
            },
          },
          runtime: {
            OnInstalledReason: {
              CHROME_UPDATE: "chrome_update",
              INSTALL: "install",
              SHARED_MODULE_UPDATE: "shared_module_update",
              UPDATE: "update",
            },
            OnRestartRequiredReason: {
              APP_UPDATE: "app_update",
              OS_UPDATE: "os_update",
              PERIODIC: "periodic",
            },
            PlatformArch: {
              ARM: "arm",
              ARM64: "arm64",
              MIPS: "mips",
              MIPS64: "mips64",
              X86_32: "x86-32",
              X86_64: "x86-64",
            },
            PlatformNaclArch: {
              ARM: "arm",
              MIPS: "mips",
              MIPS64: "mips64",
              X86_32: "x86-32",
              X86_64: "x86-64",
            },
            PlatformOs: {
              ANDROID: "android",
              CROS: "cros",
              LINUX: "linux",
              MAC: "mac",
              OPENBSD: "openbsd",
              WIN: "win",
            },
            RequestUpdateCheckStatus: {
              NO_UPDATE: "no_update",
              THROTTLED: "throttled",
              UPDATE_AVAILABLE: "update_available",
            },
          },
        };
      }

      // 3. Mock chrome runtime
      if (evasionConfig.chromeRuntime) {
        if (!window.chrome) {
          window.chrome = {};
        }
        window.chrome.runtime = window.chrome.runtime || {
          connect: () => {},
          sendMessage: () => {},
        };
      }

      // 4. Set realistic navigator languages
      if (evasionConfig.navigatorLanguages) {
        Object.defineProperty(navigator, "languages", {
          get: () => ["en-US", "en"],
        });
      }

      // 5. Mock permissions API
      if (evasionConfig.navigatorPermissions) {
        const originalQuery = Permissions.prototype.query;
        Permissions.prototype.query = function (
          parameters: any
        ): Promise<any> {
          if (parameters.name === "notifications") {
            return Promise.resolve({
              state: Notification.permission,
              onchange: null,
              addEventListener: () => {},
              removeEventListener: () => {},
              dispatchEvent: () => true,
            });
          }
          return originalQuery.call(this, parameters);
        };
      }

      // 6. Mock navigator plugins
      if (evasionConfig.navigatorPlugins) {
        Object.defineProperty(navigator, "plugins", {
          get: () => {
            const plugins = [
              { name: "Chrome PDF Plugin", filename: "internal-pdf-viewer" },
              {
                name: "Chrome PDF Viewer",
                filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
              },
              {
                name: "Native Client",
                filename: "internal-nacl-plugin",
              },
            ];

            const pluginArray = Object.create(PluginArray.prototype);
            plugins.forEach((p, i) => {
              const plugin = Object.create(Plugin.prototype);
              Object.defineProperties(plugin, {
                name: { value: p.name },
                filename: { value: p.filename },
                description: { value: "" },
                length: { value: 0 },
              });
              pluginArray[i] = plugin;
            });

            Object.defineProperty(pluginArray, "length", {
              value: plugins.length,
            });
            pluginArray.item = (index: number) => pluginArray[index] || null;
            pluginArray.namedItem = (name: string) =>
              plugins.find((p) => p.name === name) || null;
            pluginArray.refresh = () => {};

            return pluginArray;
          },
        });
      }

      // 7. Mock WebGL vendor and renderer
      if (evasionConfig.webglVendor) {
        const getParameterProxyHandler = {
          apply: function (
            target: any,
            thisArg: any,
            args: [number]
          ) {
            const param = args[0];
            const gl = thisArg;

            // UNMASKED_VENDOR_WEBGL
            if (param === 37445) {
              return "Google Inc. (NVIDIA)";
            }
            // UNMASKED_RENDERER_WEBGL
            if (param === 37446) {
              return "ANGLE (NVIDIA, NVIDIA GeForce GTX 1080 Direct3D11 vs_5_0 ps_5_0, D3D11)";
            }

            return Reflect.apply(target, gl, args);
          },
        };

        const addProxyToContext = (contextName: string) => {
          const original = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function (
            type: string,
            ...args: any[]
          ) {
            const context = original.call(
              this,
              type,
              ...args
            );
            if (
              context &&
              (type === contextName || type === `experimental-${contextName}`)
            ) {
              const ctx = context;
              ctx.getParameter = new Proxy(
                ctx.getParameter,
                getParameterProxyHandler
              );
            }
            return context;
          };
        };

        addProxyToContext("webgl");
        addProxyToContext("webgl2");
      }

      // 8. Fix window outer dimensions
      if (evasionConfig.windowOuterDimensions) {
        Object.defineProperty(window, "outerWidth", {
          get: () => window.innerWidth,
        });
        Object.defineProperty(window, "outerHeight", {
          get: () => window.innerHeight + 85, // Account for browser chrome
        });
      }

      // 9. Prevent console.debug detection
      if (evasionConfig.consoleDebug) {
        // Some sites check if console.debug is native
        const nativeDebug = console.debug;
        console.debug = function (...args: unknown[]) {
          return nativeDebug.apply(console, args);
        };
        // Make it look native
        Object.defineProperty(console.debug, "toString", {
          value: () => "function debug() { [native code] }",
        });
      }
    },
    {
      webdriver: evasions.webdriver,
      chromeApp: evasions.chromeApp,
      chromeRuntime: evasions.chromeRuntime,
      navigatorLanguages: evasions.navigatorLanguages,
      navigatorPermissions: evasions.navigatorPermissions,
      navigatorPlugins: evasions.navigatorPlugins,
      webglVendor: evasions.webglVendor,
      windowOuterDimensions: evasions.windowOuterDimensions,
      consoleDebug: evasions.consoleDebug,
    }
  );
}

/**
 * Get default stealth options
 */
export function getDefaultStealthOptions(): StealthOptions {
  return {
    enabled: true,
    evasions: {
      webdriver: true,
      chromeApp: true,
      chromeRuntime: true,
      navigatorLanguages: true,
      navigatorPermissions: true,
      navigatorPlugins: true,
      webglVendor: true,
      windowOuterDimensions: true,
      consoleDebug: true,
    },
  };
}
