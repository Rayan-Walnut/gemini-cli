// Abstraction for process-related operations
export interface ProcessApi {
  getEnv(key: string): string | undefined;
  getPlatform(): string;
  exit(code?: number): void;
}

// Default implementation using Node.js process
export const NodeProcessApi: ProcessApi = {
  getEnv: (key) => process.env[key],
  getPlatform: () => process.platform,
  exit: (code) => process.exit(code),
};
