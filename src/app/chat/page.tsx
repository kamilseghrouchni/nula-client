'use client';

import { useChat } from '@ai-sdk/react';
import { useState, useMemo, useEffect, useRef } from 'react';
import { MessageItem } from '@/components/chat/MessageItem';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton
} from '@/components/ai-elements/conversation';
import { Suggestion, Suggestions } from '@/components/ai-elements/elements/suggestion';
import { suggestions } from '@/lib/data/suggestions';
import { extractFollowupQuestion } from '@/lib/utils/followup';
import { extractPlans } from '@/lib/utils/extractPlans';
import { Send, Loader2, Network, Sparkles, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RightPanel } from '@/components/RightPanel';
import { HiddenArtifactPool } from '@/components/artifact/HiddenArtifactPool';
import { buildWorkflowGraph } from '@/lib/workflow/workflowBuilder';

export default function ChatPage() {
  const [input, setInput] = useState('');
  const [suggestedFollowup, setSuggestedFollowup] = useState<string | null>(null);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const { messages, sendMessage, status, error } = useChat();

  // Ref to store the last complete workflow graph (preserves during streaming)
  const lastCompleteWorkflowRef = useRef<{ nodes: any[]; edges: any[] }>({ nodes: [], edges: [] });

  // State to hold node insights extracted via LLM (nodeId -> insight)
  const [nodeInsights, setNodeInsights] = useState<Record<string, string>>({});

  // Extract follow-up question from last assistant message
  useEffect(() => {
    // Only extract when not streaming and messages exist
    if (status !== 'streaming' && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];

      // Only process assistant messages
      if (lastMessage.role === 'assistant' && lastMessage.parts) {
        // Get all text parts and combine them
        const textParts = lastMessage.parts
          .filter((part: any) => part.type === 'text')
          .map((part: any) => part.text || '')
          .join('\n');

        // Extract follow-up question
        const followup = extractFollowupQuestion(textParts);

        if (followup) {
          console.log('[Followup] Extracted:', followup);
          setSuggestedFollowup(followup);
        } else {
          // Clear if no follow-up found
          setSuggestedFollowup(null);
        }
      }
    }
  }, [messages, status]);

  // Extract all artifacts from messages for the notebook
  // Use stringified messages length, IDs, and part counts to prevent unnecessary recomputation
  const messageSignature = useMemo(
    () => messages.map(m => `${m.id}-${m.parts?.length || 0}`).join(','),
    [messages]
  );

  const artifacts = useMemo(() => {
    const allArtifacts: any[] = [];
    let artifactCounter = 0; // Global counter to ensure unique IDs

    // Regex for code blocks in markdown
    const jsxCodeBlockRegex = /```(?:jsx|javascript|tsx|js|typescript|ts)[\s\n]([\s\S]*?)```/g;

    // Regex for artifact tags (e.g., <artifact>...</artifact>)
    const artifactTagRegex = /<artifact[^>]*>([\s\S]*?)<\/artifact>/g;

    messages.forEach((message) => {
      if (message.role === 'assistant' && message.parts) {
        message.parts.forEach((part: any, partIdx: number) => {
          if (part.type === 'text') {
            const text = part.text || '';

            // Extract from markdown code blocks
            const codeBlockMatches = Array.from(text.matchAll(jsxCodeBlockRegex));
            codeBlockMatches.forEach((match: any, idx: number) => {
              allArtifacts.push({
                id: `artifact-${message.id}-p${partIdx}-cb${idx}-${artifactCounter++}`,
                code: match[1].trim(),
                createdAt: 0,
              });
            });

            // Extract from artifact tags
            const artifactTagMatches = Array.from(text.matchAll(artifactTagRegex));
            artifactTagMatches.forEach((match: any, idx: number) => {
              // Content inside <artifact> tags should be JSX code
              const artifactContent = match[1].trim();
              // Check if it contains code blocks, extract them
              const innerCodeMatches = Array.from(artifactContent.matchAll(jsxCodeBlockRegex));

              if (innerCodeMatches.length > 0) {
                innerCodeMatches.forEach((innerMatch: any, innerIdx: number) => {
                  allArtifacts.push({
                    id: `artifact-${message.id}-p${partIdx}-tag${idx}-${innerIdx}-${artifactCounter++}`,
                    code: innerMatch[1].trim(),
                    createdAt: 0,
                  });
                });
              } else {
                // If no code block inside, treat the whole content as JSX
                allArtifacts.push({
                  id: `artifact-${message.id}-p${partIdx}-tag${idx}-${artifactCounter++}`,
                  code: artifactContent,
                  createdAt: 0,
                });
              }
            });
          }
        });
      }
    });

    console.log('[Artifacts] Extracted count:', allArtifacts.length);
    if (allArtifacts.length > 0) {
      console.log('[Artifacts] IDs:', allArtifacts.map(a => a.id));
    }

    return allArtifacts;
  }, [messageSignature, messages]);

  // Extract all plans from messages
  const plans = useMemo(() => {
    return extractPlans(messages);
  }, [messageSignature, messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (status !== 'ready') return;

    // If input has text, send it
    if (input.trim()) {
      sendMessage({ text: input });
      setInput('');
      setSuggestedFollowup(null); // Clear suggestion after sending
    }
    // If input is empty but we have a suggestion, send the suggestion
    else if (suggestedFollowup) {
      console.log('[Followup] Sending suggested question:', suggestedFollowup);
      sendMessage({ text: suggestedFollowup });
      setSuggestedFollowup(null); // Clear suggestion after sending
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInput(newValue);

    // Clear suggestion as soon as user starts typing
    if (newValue.length > 0 && suggestedFollowup) {
      setSuggestedFollowup(null);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (status === 'ready') {
      sendMessage({ text: suggestion });
      setInput('');
      setSuggestedFollowup(null); // Clear any existing follow-up
    }
  };

  const handlePlanBuild = (planId: string) => {
    // Find the plan by ID
    const plan = plans.find(p => p.id === planId);
    if (!plan || status !== 'ready') return;

    // Extract the first step from the plan to avoid breaking context window
    // Plans are typically formatted as: "1. First step\n2. Second step..."
    const extractFirstStep = (content: string): string => {
      // Find where step 2 starts
      const step2Index = content.search(/\n\s*2\./);
      let firstStepText = step2Index > -1 ? content.substring(0, step2Index) : content;

      // Remove the "1." prefix if present
      firstStepText = firstStepText.replace(/^\s*1\.\s*/, '').trim();

      // Limit length to prevent context issues
      if (firstStepText.length > 200) {
        firstStepText = firstStepText.substring(0, 197) + '...';
      }

      return firstStepText;
    };

    const firstStep = extractFirstStep(plan.content);
    const buildMessage = `Let's start with the first step: ${firstStep}`;
    sendMessage({ text: buildMessage });
    setInput('');
    setSuggestedFollowup(null);
  };

  const handlePlanBuildFromContent = (content: string) => {
    if (status !== 'ready') return;

    // Send plan content as a build request
    const buildMessage = `Please build this plan:\n\n${content}`;
    sendMessage({ text: buildMessage });
    setInput('');
    setSuggestedFollowup(null);
  };

  // Determine if right panel should be shown
  const hasArtifacts = artifacts.length > 0;
  const hasPlans = plans.length > 0;

  // Check if there's workflow data (messages with analysis)
  // CRITICAL: Only rebuild workflow when NOT streaming to ensure we capture complete responses
  // If we rebuild during streaming, we'll only get partial text from incomplete messages
  const workflowGraph = useMemo(() => {
    const timestamp = new Date().toISOString().substring(11, 23);

    if (status === 'streaming') {
      console.log(`⏸️ [${timestamp}] [Workflow/Chat] Skipping rebuild during streaming, using cached graph with ${lastCompleteWorkflowRef.current.nodes.length} nodes`);
      // Return previous graph during streaming to preserve visualization
      return lastCompleteWorkflowRef.current;
    }

    console.log(`🔄 [${timestamp}] [Workflow/Chat] Building graph from ${messages.length} complete messages`);
    const baseGraph = buildWorkflowGraph(messages);

    // Enrich nodes with LLM-extracted insights
    const enrichedGraph = {
      ...baseGraph,
      nodes: baseGraph.nodes.map(node => {
        const llmInsight = nodeInsights[node.id];
        if (llmInsight && !node.metadata?.insight) {
          return {
            ...node,
            metadata: {
              ...node.metadata,
              insight: llmInsight
            }
          };
        }
        return node;
      })
    };

    console.log(`✅ [${timestamp}] [Workflow/Chat] Built graph with ${enrichedGraph.nodes.length} nodes`);
    if (enrichedGraph.nodes.length > 0) {
      const firstNode = enrichedGraph.nodes[0];
      console.log(`📊 [${timestamp}] [Workflow/Chat] First node sample:`, {
        id: firstNode.id,
        phase: firstNode.phase,
        hasMetadata: !!firstNode.metadata,
        metadataInsight: firstNode.metadata?.insight,
        fullResponseLength: firstNode.fullResponse?.length || 0,
        fullResponsePreview: firstNode.fullResponse?.substring(0, 100)
      });
    }

    // Cache the enriched graph
    lastCompleteWorkflowRef.current = enrichedGraph;

    return enrichedGraph;
  }, [
    messages,
    messageSignature,
    status, // Add status to dependencies so we rebuild when streaming completes
    nodeInsights // Rebuild when insights are extracted
  ]);
  const hasWorkflow = workflowGraph.nodes.length > 0;

  // Extract insights for nodes that don't have them yet (using LLM)
  useEffect(() => {
    const extractMissingInsights = async () => {
      console.log(`🔍 [Insight Extraction] Effect triggered - status: ${status}, nodes: ${workflowGraph.nodes.length}`);

      if (status === 'streaming' || workflowGraph.nodes.length === 0) {
        console.log(`⏸️ [Insight Extraction] Skipping - streaming or no nodes`);
        return;
      }

      // Debug: Log node states
      workflowGraph.nodes.forEach((node, idx) => {
        console.log(`📋 [Insight Extraction] Node ${idx}:`, {
          id: node.id.substring(0, 25),
          hasMetadataInsight: !!node.metadata?.insight,
          metadataInsight: node.metadata?.insight?.substring(0, 50),
          hasStateInsight: !!nodeInsights[node.id],
          fullResponseLength: node.fullResponse?.length || 0
        });
      });

      // Find nodes without insights that have fullResponse text
      // AND that we haven't already extracted insights for
      const nodesNeedingInsights = workflowGraph.nodes.filter(
        node =>
          !node.metadata?.insight &&
          !nodeInsights[node.id] && // Skip if we already have insight in state
          node.fullResponse &&
          node.fullResponse.length > 50
      );

      if (nodesNeedingInsights.length === 0) {
        console.log(`✋ [Insight Extraction] No nodes need insights - all have either metadata.insight or are in state`);
        return;
      }

      console.log(`🤖 [Insight Extraction] Found ${nodesNeedingInsights.length} nodes needing LLM insight extraction`);

      // Extract insights for each node (in parallel)
      const insightPromises = nodesNeedingInsights.map(async (node) => {
        try {
          console.log(`🔄 [Insight Extraction] Calling API for node ${node.id.substring(0, 20)}...`);
          const response = await fetch('/api/extract-insight', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              responseText: node.fullResponse,
              phase: node.phase
            })
          });

          if (!response.ok) {
            console.error(`❌ [Insight Extraction] Failed to extract insight for node ${node.id}`);
            return null;
          }

          const { insight } = await response.json();
          console.log(`✅ [Insight Extraction] Extracted for node ${node.id.substring(0, 20)}: "${insight}"`);

          return { nodeId: node.id, insight };
        } catch (error) {
          console.error(`❌ [Insight Extraction] Error extracting insight for node ${node.id}:`, error);
          return null;
        }
      });

      const results = await Promise.all(insightPromises);

      // Add extracted insights to state
      // This will trigger a re-render and the useMemo will merge them into the graph
      setNodeInsights(prev => {
        const newInsights = { ...prev };
        let addedCount = 0;
        results.forEach(result => {
          if (result?.nodeId && result.insight) {
            newInsights[result.nodeId] = result.insight;
            addedCount++;
          }
        });
        console.log(`📝 [Insight Extraction] Added ${addedCount} insights to state`);
        return newInsights;
      });
    };

    extractMissingInsights();
  }, [workflowGraph.nodes.length, status]); // Run when graph changes and not streaming

  // Show right panel if either artifacts, plans, or workflow exists AND user wants it open
  const showRightPanel = (hasArtifacts || hasPlans || hasWorkflow) && rightPanelOpen;

  // Auto-open panel when NEW artifacts, plans, or workflow appear (only on first appearance)
  // Use refs to track previous counts to avoid re-opening after user closes
  const prevCountRef = useRef({ artifacts: 0, plans: 0, workflow: 0 });

  useEffect(() => {
    const currentCount = {
      artifacts: artifacts.length,
      plans: plans.length,
      workflow: workflowGraph.nodes.length
    };

    const hasNewContent =
      currentCount.artifacts > prevCountRef.current.artifacts ||
      currentCount.plans > prevCountRef.current.plans ||
      currentCount.workflow > prevCountRef.current.workflow;

    // Only auto-open if there's NEW content and panel is currently closed
    if (hasNewContent && !rightPanelOpen) {
      setRightPanelOpen(true);
    }

    prevCountRef.current = currentCount;
  }, [artifacts.length, plans.length, workflowGraph.nodes.length, rightPanelOpen]);

  return (
    <div className="flex h-screen relative bg-background">

      {messages.length === 0 ? (
        // Welcome Screen - Full Page
        <div className="w-full h-full flex items-center justify-center relative">
          {/* Welcome Content - Centered */}
          <div className="text-center px-4 sm:px-8 max-w-6xl mx-auto w-full">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-foreground mb-4">
              MCP Web Client
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground mb-12">
              AI-powered data analysis with Model Context Protocol
            </p>

            {/* Centered Input */}
            <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
              <div className="flex gap-3 sm:gap-4">
                <div className="relative flex-1">
                  <input
                    value={input}
                    onChange={handleInputChange}
                    disabled={status !== 'ready'}
                    className="w-full border border-border rounded-lg px-6 py-4 text-base sm:text-lg bg-card backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder={suggestedFollowup ? "" : "Ask about your data..."}
                  />
                  {/* Show suggested follow-up when input is empty and suggestion exists */}
                  {!input && suggestedFollowup && status === 'ready' && (
                    <div className="absolute inset-0 px-6 py-4 text-base sm:text-lg pointer-events-none flex items-center text-muted-foreground/70">
                      {suggestedFollowup}
                    </div>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={(!input.trim() && !suggestedFollowup) || status !== 'ready'}
                  className="px-6 py-4 text-base sm:text-lg rounded-lg"
                >
                  {status === 'streaming' ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <Send className="w-6 h-6" />
                  )}
                </Button>
              </div>
            </form>

            {/* Suggestion Chips */}
            <div className="max-w-4xl mx-auto mt-6 sm:mt-8">
              <Suggestions>
                {suggestions.map((suggestion) => (
                  <Suggestion
                    key={suggestion}
                    suggestion={suggestion}
                    onClick={handleSuggestionClick}
                    disabled={status !== 'ready'}
                  />
                ))}
              </Suggestions>
            </div>
          </div>
        </div>
      ) : (
        // Chat Area - Expands to full width when panel closed, 50% when panel open
        <div className={`flex flex-col transition-all duration-300 ${showRightPanel ? 'w-1/2 border-r' : 'w-full'} border-border relative`}>
          {/* Header */}
          <div className="bg-card backdrop-blur-sm border-b border-border px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-5 flex-shrink-0">
            <div className={`flex items-center justify-between ${showRightPanel ? '' : 'max-w-7xl mx-auto'}`}>
              <div>
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
                  <span className="inline-block w-2 h-2 sm:w-2.5 sm:h-2.5 bg-primary rounded-full" />
                  AI Assistant
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  AI-powered data analysis with MCP tools
                </p>
              </div>
              <div className="flex gap-2">
                {hasPlans && (
                  <Button
                    variant={rightPanelOpen ? "default" : "outline"}
                    size="sm"
                    onClick={() => setRightPanelOpen(!rightPanelOpen)}
                    className="gap-2"
                  >
                    <Sparkles size={16} />
                    <span className="hidden sm:inline">
                      {rightPanelOpen ? "Hide Plans" : "Plans"}
                    </span>
                  </Button>
                )}
                {hasWorkflow && (
                  <Button
                    variant={rightPanelOpen ? "default" : "outline"}
                    size="sm"
                    onClick={() => setRightPanelOpen(!rightPanelOpen)}
                    className="gap-2"
                  >
                    <Network size={16} />
                    <span className="hidden sm:inline">
                      {rightPanelOpen ? "Hide Workflow" : "Workflow"}
                    </span>
                  </Button>
                )}
                {hasArtifacts && (
                  <Button
                    variant={rightPanelOpen ? "default" : "outline"}
                    size="sm"
                    onClick={() => setRightPanelOpen(!rightPanelOpen)}
                    className="gap-2"
                  >
                    <FlaskConical size={16} />
                    <span className="hidden sm:inline">
                      {rightPanelOpen ? "Hide Notebook" : "Notebook"}
                    </span>
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Messages Container with AI SDK Conversation */}
          <Conversation className="flex-1">
            <ConversationContent className={`${showRightPanel ? 'px-3 sm:px-4 md:px-6' : 'max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 xl:px-12'} w-full space-y-3 sm:space-y-4`}>
              {messages.map((message, idx) => (
                <MessageItem
                  key={message.id}
                  message={message}
                  isStreaming={status === 'streaming' && idx === messages.length - 1}
                  onPlanBuild={handlePlanBuildFromContent}
                />
              ))}

              {error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive">
                  <p className="font-semibold">Error</p>
                  <p className="text-sm mt-1">{error.message}</p>
                </div>
              )}
            </ConversationContent>

            <ConversationScrollButton />
          </Conversation>

          {/* Input - Fixed at bottom */}
          <div className="bg-card backdrop-blur-sm border-t border-border p-6 flex-shrink-0">
            {/* Smart Follow-up Suggestion Chip */}
            {!input && suggestedFollowup && status === 'ready' && (
              <div className="mb-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    sendMessage({ text: suggestedFollowup });
                    setSuggestedFollowup(null);
                  }}
                  className="group flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-lg text-sm text-primary transition-all hover:scale-[1.02]"
                >
                  <Sparkles size={14} className="flex-shrink-0" />
                  <span className="line-clamp-1">{suggestedFollowup}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSuggestedFollowup(null)}
                  className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Dismiss suggestion"
                >
                  ✕
                </button>
              </div>
            )}
            <form onSubmit={handleSubmit} className={showRightPanel ? '' : 'max-w-7xl mx-auto'}>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <input
                    value={input}
                    onChange={handleInputChange}
                    disabled={status !== 'ready'}
                    className="w-full border border-border rounded-lg px-6 py-4 text-lg bg-background backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Ask about your data..."
                  />
                </div>
                <Button
                  type="submit"
                  disabled={(!input.trim() && !suggestedFollowup) || status !== 'ready'}
                  size="lg"
                  className="gap-2"
                >
                  {status === 'streaming' ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-6 h-6" />
                      <span>Send</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Right Panel - Shows plans, workflow, notebook, or combination with tabs */}
      {showRightPanel && (
        <div className="w-1/2 h-full">
          <RightPanel
            messages={messages}
            artifacts={artifacts}
            plans={plans}
            hasWorkflow={hasWorkflow}
            hasArtifacts={hasArtifacts}
            hasPlans={hasPlans}
            initialTab={hasPlans ? "plans" : hasArtifacts ? "notebook" : "workflow"}
            onClose={() => setRightPanelOpen(false)}
            onPlanBuild={handlePlanBuild}
          />
        </div>
      )}

      {/* Hidden artifact pool for download functionality */}
      <HiddenArtifactPool artifacts={artifacts} />
    </div>
  );
}