export type JsonSchema = Record<string, unknown>;

export type WebMcpTool = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
    untrustedContentHint?: boolean;
  };
  execute: (input: unknown, context?: { signal: AbortSignal }) => unknown | Promise<unknown>;
};

export type NativeModelContext = {
  registerTool: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => Promise<void>;
  getTools?: () => Promise<WebMcpTool[]>;
};

declare global {
  interface Document {
    modelContext?: NativeModelContext;
  }

  interface Window {
    __repairbenchWebMcp?: {
      mode: "native" | "preview";
      listTools: () => string[];
      invoke: (name: string, input?: unknown) => Promise<unknown>;
    };
  }
}
