import type { UIMessage } from "@ai-sdk/react";

export type { UIMessage };

export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    toolInvocations?: ToolInvocation[];
    createdAt: Date;
  }

  export interface ToolInvocation {
    toolCallId: string;
    toolName: string;
    args: Record<string, any>;
    result?: any;
    state: 'pending' | 'running' | 'result' | 'error';
  }

  export interface Artifact {
    id: string;
    type: 'jsx' | 'text' | 'json';
    content: string;
    title?: string;
  }

  export interface Plan {
    id: string;
    title: string;
    description?: string;
    content: string;
    messageId: string;
    messageIndex: number;
    timestamp: number;
    isStreaming?: boolean;
  }

  // MCP Resource message part
  export interface ResourceFetchPart {
    type: 'resource-fetch';
    serverName: string;
    uri: string;
    status: 'fetching' | 'complete' | 'error';
    resource?: {
      name: string;
      title?: string;
      description?: string;
      mimeType?: string;
      content: string;
    };
    error?: string;
  }

  // MCP Prompt message part
  export interface PromptFetchPart {
    type: 'prompt-fetch';
    serverName: string;
    promptName: string;
    args: Record<string, any>;
    status: 'fetching' | 'complete' | 'error';
    prompt?: {
      description?: string;
      messages: Array<{
        role: 'user' | 'assistant';
        content: string;
      }>;
    };
    error?: string;
  }