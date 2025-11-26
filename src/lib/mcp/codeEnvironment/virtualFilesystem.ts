/**
 * Virtual Filesystem for MCP Code Execution Environment
 *
 * Provides an in-memory filesystem abstraction where MCP tools are represented
 * as importable TypeScript modules. This enables Claude to discover and use
 * tools on-demand rather than loading all definitions upfront.
 */

export interface VirtualFile {
  path: string;
  content: string;
  type: 'file' | 'directory';
}

export interface VirtualFilesystem {
  files: Record<string, string>;
}

/**
 * Read a file from the virtual filesystem
 */
export function readFile(fs: VirtualFilesystem, path: string): string {
  const normalizedPath = normalizePath(path);
  const content = fs.files[normalizedPath];

  if (content === undefined) {
    throw new Error(`File not found: ${path}`);
  }

  return content;
}

/**
 * List files in a directory
 */
export function listDirectory(fs: VirtualFilesystem, path: string): string[] {
  const normalizedPath = normalizePath(path);
  const prefix = normalizedPath.endsWith('/') ? normalizedPath : `${normalizedPath}/`;

  const entries = new Set<string>();

  for (const filePath of Object.keys(fs.files)) {
    if (filePath.startsWith(prefix)) {
      const relativePath = filePath.slice(prefix.length);
      const firstSegment = relativePath.split('/')[0];

      if (firstSegment) {
        entries.add(firstSegment);
      }
    }
  }

  return Array.from(entries).sort();
}

/**
 * Check if a file or directory exists
 */
export function exists(fs: VirtualFilesystem, path: string): boolean {
  const normalizedPath = normalizePath(path);

  // Check for exact file match
  if (fs.files[normalizedPath] !== undefined) {
    return true;
  }

  // Check for directory (any file starts with this path)
  const prefix = normalizedPath.endsWith('/') ? normalizedPath : `${normalizedPath}/`;
  return Object.keys(fs.files).some(filePath => filePath.startsWith(prefix));
}

/**
 * Generate a tree representation of the filesystem for display
 */
export function generateFilesystemTree(fs: VirtualFilesystem): string {
  const paths = Object.keys(fs.files).sort();
  const tree: string[] = [];

  // Build tree structure
  const processedDirs = new Set<string>();

  for (const path of paths) {
    const parts = path.split('/').filter(Boolean);

    // Add parent directories
    for (let i = 1; i < parts.length; i++) {
      const dirPath = '/' + parts.slice(0, i).join('/');
      if (!processedDirs.has(dirPath)) {
        const indent = '  '.repeat(i - 1);
        const dirName = parts[i - 1];
        tree.push(`${indent}├── ${dirName}/`);
        processedDirs.add(dirPath);
      }
    }

    // Add file
    const indent = '  '.repeat(parts.length - 1);
    const fileName = parts[parts.length - 1];
    tree.push(`${indent}├── ${fileName}`);
  }

  return tree.join('\n');
}

/**
 * Normalize path to always start with / and remove trailing slashes from files
 */
function normalizePath(path: string): string {
  let normalized = path;

  // Ensure starts with /
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }

  // Remove duplicate slashes
  normalized = normalized.replace(/\/+/g, '/');

  return normalized;
}

/**
 * Get all files in the filesystem
 */
export function getAllFiles(fs: VirtualFilesystem): VirtualFile[] {
  return Object.entries(fs.files).map(([path, content]) => ({
    path,
    content,
    type: 'file' as const
  }));
}
