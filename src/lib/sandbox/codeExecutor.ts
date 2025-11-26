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

import { VM } from 'vm2';
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

    // Transpile TypeScript to JavaScript
    const transpiledCode = transpileTypeScript(code);

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

    // Create VM with sandbox environment
    const vmConfig = getVM2Config();
    const vm = new VM({
      ...vmConfig,
      sandbox: {
        console: sandboxConsole,
        callMCPTool: mcpBridge.callMCPTool,
      },
    });

    // Wrap code to handle async and imports
    const wrappedCode = wrapCodeWithImportSupport(transpiledCode, virtualFS);

    // Execute code
    const result = await vm.run(wrappedCode);

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
  // For now, we'll use a simplified approach where we inline the virtual filesystem
  // A more sophisticated implementation would create a proper module loader

  return `
(async function() {
  // Virtual filesystem
  const __virtualFS = ${JSON.stringify(virtualFS.files)};

  // Simple module cache
  const __moduleCache = {};

  // Simple require implementation for virtual modules
  function __require(modulePath) {
    if (__moduleCache[modulePath]) {
      return __moduleCache[modulePath].exports;
    }

    const code = __virtualFS[modulePath];
    if (!code) {
      throw new Error('Module not found: ' + modulePath);
    }

    const module = { exports: {} };
    const exports = module.exports;

    // Create module function
    const moduleFunc = new Function('exports', 'module', '__require', 'callMCPTool', code);
    moduleFunc(exports, module, __require, callMCPTool);

    __moduleCache[modulePath] = module;
    return module.exports;
  }

  // Import helper for ES6 imports
  function __import(modulePath) {
    // Resolve relative paths
    if (modulePath.startsWith('./') || modulePath.startsWith('../')) {
      // For simplicity, assume imports are from /workspace/
      if (!modulePath.startsWith('/')) {
        modulePath = '/workspace/' + modulePath.replace(/^\.\//, '');
      }
    }

    // Add .ts extension if not present
    if (!modulePath.endsWith('.ts') && !modulePath.endsWith('.js')) {
      // Try .ts first, then /index.ts
      if (__virtualFS[modulePath + '.ts']) {
        modulePath = modulePath + '.ts';
      } else if (__virtualFS[modulePath + '/index.ts']) {
        modulePath = modulePath + '/index.ts';
      }
    }

    return __require(modulePath);
  }

  // Execute user code
  ${code}
})();
  `;
}
