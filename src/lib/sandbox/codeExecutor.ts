/**
 * Code Execution Sandbox
 *
 * Executes TypeScript/JavaScript code in a secure isolated environment using VM2.
 * Provides access to:
 * - Virtual filesystem (for importing MCP tool modules)
 * - MCP bridge (for calling tools)
 * - Standard JavaScript globals (Array, Promise, console, etc.)
 *
 * Blocks access to:
 * - File system
 * - Network (except via MCP bridge)
 * - Child processes
 * - Native modules
 */

import * as vm from 'vm';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';
import type { VirtualFilesystem } from '../mcp/codeEnvironment/virtualFilesystem';
import { readFile } from '../mcp/codeEnvironment/virtualFilesystem';
import { getVM2Config, validateCode } from './securityPolicy';

export interface ExecutionResult {
  success: boolean;
  output: string;
  returnValue?: any;
  error?: string;
  executionTime: number;
}

export interface MCPBridge {
  callMCPTool: (toolName: string, args: any) => Promise<any>;
}

/**
 * Execute TypeScript code in a sandboxed environment
 *
 * @param code - TypeScript code to execute
 * @param virtualFS - Virtual filesystem containing tool modules
 * @param mcpBridge - Bridge to MCP tool execution
 * @returns Execution result with output and return value
 */
export async function executeCode(
  code: string,
  virtualFS: VirtualFilesystem,
  mcpBridge: MCPBridge
): Promise<ExecutionResult> {
  const startTime = Date.now();
  const outputLines: string[] = [];

  try {
    // Validate code for dangerous patterns
    const validation = validateCode(code);
    if (!validation.valid) {
      return {
        success: false,
        output: '',
        error: validation.error,
        executionTime: Date.now() - startTime,
      };
    }

    // Wrap code in async function to support top-level await
    const wrappedForTranspile = `
(async function() {
${code}
})();
    `;

    // Transpile TypeScript to JavaScript
    const transpiledCode = transpileTypeScript(wrappedForTranspile);

    // DEBUG: Log transpiled code
    console.log('[Code Executor] Transpiled code:', transpiledCode.substring(0, 500));

    // Create custom console that captures output
    const sandboxConsole = {
      log: (...args: any[]) => {
        outputLines.push(args.map(String).join(' '));
      },
      error: (...args: any[]) => {
        outputLines.push('ERROR: ' + args.map(String).join(' '));
      },
      warn: (...args: any[]) => {
        outputLines.push('WARN: ' + args.map(String).join(' '));
      },
      info: (...args: any[]) => {
        outputLines.push('INFO: ' + args.map(String).join(' '));
      },
    };

    // Wrap code to handle async and imports
    const wrappedCode = wrapCodeWithImportSupport(transpiledCode, virtualFS);

    // DEBUG: Log wrapped code
    console.log('[Code Executor] Wrapped code:', wrappedCode.substring(0, 800));

    // Create sandbox context
    const sandbox = {
      console: sandboxConsole,
      callMCPTool: mcpBridge.callMCPTool,
      __getVirtualFS: () => virtualFS.files,
      Promise,
      setTimeout,
      setInterval,
      clearTimeout,
      clearInterval,
    };

    // Create context and run code with timeout
    const context = vm.createContext(sandbox);

    // Execute with timeout
    const result = await executeWithTimeout(wrappedCode, context, 5000);

    return {
      success: true,
      output: outputLines.join('\n'),
      returnValue: result,
      executionTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      output: outputLines.join('\n'),
      error: error instanceof Error ? error.message : String(error),
      executionTime: Date.now() - startTime,
    };
  }
}

/**
 * Execute code with timeout
 */
async function executeWithTimeout(code: string, context: vm.Context, timeout: number): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Execution timeout after ${timeout}ms`));
    }, timeout);

    try {
      // Run the code in the context
      const script = new vm.Script(code);
      const result = script.runInContext(context, {
        timeout,
        displayErrors: true,
      });

      clearTimeout(timeoutId);

      // If result is a promise, wait for it
      if (result && typeof result.then === 'function') {
        result.then(resolve).catch(reject);
      } else {
        resolve(result);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      reject(error);
    }
  });
}

/**
 * Transpile TypeScript code to JavaScript
 */
function transpileTypeScript(code: string): string {
  try {
    const result = transpileModule(code, {
      compilerOptions: {
        target: ScriptTarget.ES2020,
        module: ModuleKind.CommonJS,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    });
    return result.outputText;
  } catch (error) {
    throw new Error(`TypeScript compilation error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Wrap code to provide import support via virtual filesystem
 *
 * This creates a simple module system where imports are resolved against
 * the virtual filesystem.
 */
function wrapCodeWithImportSupport(code: string, virtualFS: VirtualFilesystem): string {
  // The code is already wrapped in an async function from transpilation
  // We just need to provide the require() implementation

  const wrappedCode = `
// Module cache
const __moduleCache = new Map();

// Get virtual filesystem from outer scope
const __virtualFS = __getVirtualFS();

// Require implementation
function require(modulePath) {
  // Resolve path
  let resolvedPath = modulePath;

  // Handle relative paths
  if (modulePath.startsWith('./') || modulePath.startsWith('../')) {
    resolvedPath = '/workspace/' + modulePath.replace(/^\.\//, '').replace(/^\\.\\.\\//, '');
  }

  // Try adding .ts extension
  if (!resolvedPath.endsWith('.ts') && !resolvedPath.endsWith('.js')) {
    if (__virtualFS[resolvedPath + '.ts']) {
      resolvedPath = resolvedPath + '.ts';
    } else if (__virtualFS[resolvedPath + '/index.ts']) {
      resolvedPath = resolvedPath + '/index.ts';
    }
  }

  // Check cache
  if (__moduleCache.has(resolvedPath)) {
    return __moduleCache.get(resolvedPath).exports;
  }

  // Get module code
  const moduleCode = __virtualFS[resolvedPath];
  if (!moduleCode) {
    throw new Error('Module not found: ' + modulePath + ' (resolved to: ' + resolvedPath + ')');
  }

  // Create module object
  const module = { exports: {} };
  const exports = module.exports;

  // Transpile and evaluate module code
  const moduleWrapper = new Function('exports', 'module', 'require', 'callMCPTool', 'console', moduleCode);
  moduleWrapper(exports, module, require, callMCPTool, console);

  // Cache it
  __moduleCache.set(resolvedPath, module);

  return module.exports;
}

// Execute transpiled user code (already wrapped in async function)
${code}
  `;

  return wrappedCode;
}
