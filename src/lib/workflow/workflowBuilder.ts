import type { UIMessage } from "@/lib/types";
import type {
  WorkflowEdge,
  WorkflowGraph,
  WorkflowNode,
  WorkflowToolCall,
} from "@/lib/types/workflow";
import { detectPhaseFromTools } from "./phaseDetector";
import { extractWorkflowMetadata, extractPhase } from "./metadataExtractor";
import { extractInsightWithPhase } from "./simpleInsightExtractor";
import { nanoid } from "nanoid";

/**
 * Extract tool calls from a message
 */
function extractToolCalls(message: UIMessage): WorkflowToolCall[] {
  if (!message.parts) return [];

  const toolCalls: WorkflowToolCall[] = [];

  for (const part of message.parts) {
    // Check for both "tool-" prefix (standard) and "dynamic-tool" (MCP tools)
    if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {

      // Check if it's a tool-call part with toolName
      if ("toolName" in part && typeof part.toolName === "string") {
        // Find corresponding result
        const toolCallId = "toolCallId" in part ? part.toolCallId : undefined;
        const resultPart = message.parts.find(
          (p) =>
            p.type === "tool-result" &&
            "toolCallId" in p &&
            p.toolCallId === toolCallId
        );

        toolCalls.push({
          toolName: part.toolName,
          args: ("args" in part && part.args) ? part.args as Record<string, any> : {},
          result: resultPart && "result" in resultPart ? resultPart.result : undefined,
          isError: resultPart && "isError" in resultPart ? Boolean(resultPart.isError) : false,
        });
      }
    }
  }

  return toolCalls;
}

/**
 * Extract reasoning/thinking text from a message
 * Collects ALL text from all parts (including multiple steps)
 */
function extractReasoningText(message: UIMessage): string {
  if (!message.parts) {
    return "";
  }

  // Collect ALL text from all parts (messages can have multiple steps)
  const allText: string[] = [];

  for (const part of message.parts) {
    if ('text' in part && typeof part.text === 'string' && part.text.trim()) {
      allText.push(part.text);
    }
  }

  if (allText.length === 0) {
    return "";
  }

  // Join all text parts with newlines
  const fullText = allText.join("\n\n");

  // Return ALL text - we want the complete response including analysis
  // Don't truncate at ---ANSWER--- delimiter, we need the full context for insights
  return fullText.trim();
}

/**
 * Extract user query text from message
 */
function getMessageText(message: UIMessage): string {
  if (!message.parts) return "";

  const textParts = message.parts.filter((p) => p.type === "text");
  return textParts.map((p) => ("text" in p ? p.text : "")).join(" ");
}

/**
 * Extract label from user query (first 50 chars)
 */
function extractQueryLabel(message: UIMessage): string {
  const text = getMessageText(message);
  if (text.length <= 50) return text;
  return text.substring(0, 47) + "...";
}

/**
 * Check if message has artifacts (JSX code blocks)
 */
function hasArtifacts(message: UIMessage): boolean {
  const text = getMessageText(message);
  return /```jsx/.test(text) || /<artifact>/.test(text);
}

/**
 * Build workflow graph from conversation messages
 */
export function buildWorkflowGraph(messages: UIMessage[]): WorkflowGraph {
  const nodes: WorkflowNode[] = [];
  const edges: WorkflowEdge[] = [];

  let currentPhase = "Initial";
  let lastNodeId: string | null = null;
  let lastUserQuery: string | null = null; // Track last user query to attach to assistant response
  const phaseNodes: Map<string, string[]> = new Map(); // Track nodes by phase for parallel grouping

  messages.forEach((message, idx) => {
    if (message.role === "user") {
      // Store user query to attach to next assistant response
      // Don't create a separate node for user messages
      lastUserQuery = getMessageText(message);
    } else if (message.role === "assistant") {
      // Extract reasoning and metadata
      const reasoningText = extractReasoningText(message);

      const metadata = extractWorkflowMetadata(reasoningText);
      const toolCalls = extractToolCalls(message);

      // Determine phase from metadata or tools or text content
      if (metadata?.phase) {
        currentPhase = metadata.phase;
      } else if (toolCalls.length > 0) {
        currentPhase = detectPhaseFromTools(toolCalls, reasoningText);
      } else {
        // Try to detect phase from text content even without tool calls
        const detectedPhase = extractPhase(reasoningText);
        if (detectedPhase) {
          currentPhase = detectedPhase;
        }
      }

      // CREATE NODE FOR EVERY ASSISTANT RESPONSE (not just those with tools)
      // This creates a narrative of the analysis, not a technical trace
      const nodeId = `response-${message.id}`;
      const status: "completed" | "in_progress" | "error" =
        toolCalls.some((t) => t.isError) ? "error" : "completed";

      // Extract insight: use metadata if available, otherwise extract from text
      let finalMetadata = metadata;

      if (!finalMetadata?.insight && reasoningText) {
        const simpleInsight = extractInsightWithPhase(reasoningText, currentPhase);
        if (simpleInsight) {
          finalMetadata = {
            ...finalMetadata,
            insight: simpleInsight,
          };
        }
      }

      const node = {
        id: nodeId,
        type: "analysis" as const,
        label: `${currentPhase}`,
        phase: currentPhase,
        messageId: message.id,
        messageIndex: idx,
        userQuery: lastUserQuery || undefined, // Attach the user query that prompted this response
        toolCalls,  // Keep for internal use but won't display in UI
        fullResponse: reasoningText || undefined,
        timestamp: Date.now(),
        status,
        metadata: finalMetadata || undefined,
      };

      nodes.push(node);
      lastUserQuery = null; // Clear after attaching to response

      // Handle parallel vs sequential edges
      if (metadata?.isParallel && lastNodeId) {
        // Parallel: Add to phase group
        if (!phaseNodes.has(currentPhase)) {
          phaseNodes.set(currentPhase, []);
        }
        phaseNodes.get(currentPhase)!.push(nodeId);

        // Connect from previous node
        edges.push({
          id: `${lastNodeId}-${nodeId}`,
          source: lastNodeId,
          target: nodeId,
          type: "parallel",
        });
      } else if (lastNodeId) {
        // Sequential
        edges.push({
          id: `${lastNodeId}-${nodeId}`,
          source: lastNodeId,
          target: nodeId,
          type: "sequential",
        });
      }

      lastNodeId = nodeId;
    }
  });

  return { nodes, edges };
}

/**
 * Get nodes for a specific phase
 */
export function getNodesForPhase(
  graph: WorkflowGraph,
  phase: string
): WorkflowNode[] {
  return graph.nodes.filter((node) => node.phase === phase);
}

/**
 * Get all unique phases in the workflow
 */
export function getAllPhases(graph: WorkflowGraph): string[] {
  const phases = new Set(graph.nodes.map((node) => node.phase));
  return Array.from(phases);
}

/**
 * Get nodes by type
 */
export function getNodesByType(
  graph: WorkflowGraph,
  type: "user_query" | "analysis" | "visualization"
): WorkflowNode[] {
  return graph.nodes.filter((node) => node.type === type);
}

/**
 * Count artifacts in workflow
 */
export function countArtifacts(graph: WorkflowGraph): number {
  return graph.nodes.reduce((count, node) => {
    return count + (node.artifacts?.length || 0);
  }, 0);
}
