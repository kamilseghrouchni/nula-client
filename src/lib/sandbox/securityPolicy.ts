/**
 * Security Policy for Code Execution Sandbox
 *
 * Defines strict security constraints for running untrusted Claude-generated code:
 * - Resource limits (CPU, memory)
 * - Allowed built-in modules and globals
 * - Blocked dangerous operations
 */

export const SANDBOX_CONFIG = {
  /**
   * Maximum execution time in milliseconds
   */
  timeout: 5000, // 5 seconds

  /**
   * Memory limit in bytes (not enforced by VM2, but documented)
   */
  memoryLimit: 512 * 1024 * 1024, // 512MB

  /**
   * Allowed Node.js built-in modules
   * Only safe, read-only modules permitted
   */
  allowedBuiltins: [
    // No built-ins allowed - code must use virtual filesystem and MCP bridge only
  ] as string[],

  /**
   * Allowed global objects/functions
   * Standard JavaScript globals that are safe
   */
  allowedGlobals: [
    'Array',
    'Boolean',
    'Date',
    'Error',
    'JSON',
    'Math',
    'Number',
    'Object',
    'Promise',
    'RegExp',
    'String',
    'console', // console.log for output
    'setTimeout',
    'setInterval',
    'clearTimeout',
    'clearInterval',
  ] as string[],

  /**
   * Blocked operations
   * These will throw errors if attempted
   */
  blocked: {
    /**
     * No file system access (except virtual FS through imports)
     */
    fs: true,

    /**
     * No child process spawning
     */
    child_process: true,

    /**
     * No network access (except MCP tool calls through bridge)
     */
    net: true,
    http: true,
    https: true,
    dgram: true,

    /**
     * No native module loading
     */
    native: true,

    /**
     * No eval or Function constructor
     */
    eval: true,
  },
};

/**
 * Get VM2 sandbox configuration
 */
export function getVM2Config() {
  return {
    timeout: SANDBOX_CONFIG.timeout,
    sandbox: {
      console: console, // Allow console.log for output
      // callMCPTool will be injected at runtime
    },
    require: {
      external: false, // No external modules
      builtin: SANDBOX_CONFIG.allowedBuiltins,
      root: './',
      mock: {
        // Mock dangerous modules to throw errors
        fs: createBlockedModuleMock('fs'),
        child_process: createBlockedModuleMock('child_process'),
        net: createBlockedModuleMock('net'),
        http: createBlockedModuleMock('http'),
        https: createBlockedModuleMock('https'),
      },
    },
  };
}

/**
 * Create a mock module that throws when accessed
 */
function createBlockedModuleMock(moduleName: string) {
  return new Proxy(
    {},
    {
      get() {
        throw new Error(
          `Access to '${moduleName}' module is not allowed in sandbox for security reasons`
        );
      },
    }
  );
}

/**
 * Validate code before execution (basic checks)
 */
export function validateCode(code: string): { valid: boolean; error?: string } {
  // Check for dangerous patterns
  const dangerousPatterns = [
    /require\s*\(\s*['"]fs['"]\s*\)/,
    /require\s*\(\s*['"]child_process['"]\s*\)/,
    /require\s*\(\s*['"]net['"]\s*\)/,
    /process\.exit/,
    /process\.kill/,
    /__dirname/,
    /__filename/,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(code)) {
      return {
        valid: false,
        error: `Code contains blocked pattern: ${pattern.source}`,
      };
    }
  }

  return { valid: true };
}
