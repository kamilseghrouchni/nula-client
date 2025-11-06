'use client';

import { UIMessage } from 'ai';
import { Message, MessageAvatar, MessageContent } from '@/components/ai-elements/message';
import { Response } from '@/components/ai-elements/response';
import {
  Task,
  TaskContent,
  TaskItem,
} from '@/components/ai-elements/task';
import {
  Tool,
  ToolHeader,
  ToolContent as ToolContentComponent,
  ToolInput,
  ToolOutput,
} from '@/components/ai-elements/tool';
import { CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDownIcon, AlertCircle, Loader2, BrainIcon } from 'lucide-react';
import { useMemo, memo } from 'react';
import { cn } from '@/lib/utils';
import { removeFollowupFromText } from '@/lib/utils/followup';
import { PlanPreview } from './PlanPreview';
import {
  isToolPart,
  normalizeToolPart,
  getLastToolIndex,
  isTextPart,
  isReasoningPart,
  type NormalizedToolPart
} from '@/lib/utils/messagePartNormalizer';

interface MessageItemProps {
  message: UIMessage;
  isStreaming?: boolean;
  onPlanBuild?: (content: string) => void;
}

type ThinkingStep = {
  type: 'reasoning-text' | 'tool' | 'final-text';
  content: any;
  index: number;
};

export const MessageItem = memo(function MessageItem({ message, isStreaming = false, onPlanBuild }: MessageItemProps) {
  const isUser = message.role === 'user';

  // Handle user messages - simple display, no thinking/reasoning
  if (isUser) {
    let userContent = '';
    if (typeof (message as any).content === 'string') {
      userContent = (message as any).content;
    } else if (message.parts) {
      const textPart = message.parts.find((p: any) => p.type === 'text');
      userContent = textPart ? (textPart as any).text || '' : '';
    }

    return (
      <div className="message-enter">
        <Message from={message.role}>
          <MessageAvatar
            src={'/user-avatar.png'}
            name={'You'}
          />
          <MessageContent variant="flat">
            <Response>{userContent}</Response>
          </MessageContent>
        </Message>
      </div>
    );
  }

  // Handle simple string content (legacy format)
  if (typeof (message as any).content === 'string') {
    return (
      <div className="message-enter">
        <Message from={message.role}>
          <MessageAvatar
            src={'/assistant-avatar.png'}
            name={'AI'}
          />
          <MessageContent variant="flat">
            <Response>{(message as any).content}</Response>
          </MessageContent>
        </Message>
      </div>
    );
  }

  // Handle parts-based messages (AI SDK v5 - assistant only at this point)
  if (!message.parts || message.parts.length === 0) {
    return (
      <Message from={message.role}>
        <MessageAvatar
          src={'/assistant-avatar.png'}
          name={'AI'}
        />
      </Message>
    );
  }

  // Process parts to separate intermediate reasoning from final response
  // Show ALL intermediate thinking steps between tools
  const { thinkingSteps, finalText, planPreviews } = useMemo(() => {
    const steps: ThinkingStep[] = [];
    let final = '';
    const plans: Array<{ title: string; description?: string; content: string }> = [];

    // First pass: find the index of the last tool (unified across all transports)
    const lastToolIndex = getLastToolIndex(message);

    // Second pass: classify text parts
    let lastTextAfterTools: { text: string; index: number } | null = null as { text: string; index: number } | null;

    message.parts.forEach((part: any, idx: number) => {
      if (isTextPart(part)) {
        let text = part.text || '';

        // Extract plan tags before removing them
        const planTagRegex = /<plan(?:\s+title="([^"]*)")?(?:\s+description="([^"]*)")?\s*>([\s\S]*?)<\/plan>/g;
        const planMatches: RegExpMatchArray[] = Array.from(text.matchAll(planTagRegex));
        planMatches.forEach((match) => {
          const title = match[1] || 'Plan';
          const description = match[2] || undefined;
          const content = match[3]?.trim() || '';
          plans.push({ title, description, content });
        });

        // Remove code blocks (they render in notebook)
        text = text.replace(/```(?:jsx|javascript|tsx|js|typescript|ts)[\s\n]([\s\S]*?)```/g, '');

        // Remove artifact tags (they render in notebook)
        text = text.replace(/<artifact[^>]*>[\s\S]*?<\/artifact>/g, '');

        // Remove plan tags (they render as preview)
        text = text.replace(/<plan[^>]*>[\s\S]*?<\/plan>/g, '');

        // Remove follow-up question delimiter and text (it shows in input box)
        text = removeFollowupFromText(text);

        if (!text.trim()) return;

        // Check for ---ANSWER--- delimiter (for messages without tools)
        if (text.includes('---ANSWER---')) {
          const [thinkingPart, answerPart] = text.split('---ANSWER---');

          // Add thinking part if substantial
          if (thinkingPart.trim()) {
            steps.push({
              type: 'reasoning-text',
              content: thinkingPart.trim(),
              index: idx,
            });
          }

          // Add answer part as final response
          if (answerPart.trim()) {
            lastTextAfterTools = { text: answerPart.trim(), index: idx };
          }
          return; // Skip normal classification
        }

        // Check if this text comes after the last tool
        if (idx > lastToolIndex && lastToolIndex !== -1) {
          // This could be the final response - store it for evaluation
          lastTextAfterTools = { text: text.trim(), index: idx };
        } else if (lastToolIndex === -1) {
          // Fallback: No tools and no delimiter = show all as final response
          lastTextAfterTools = { text: text.trim(), index: idx };
        } else {
          // This is reasoning (before tools or between tools)
          steps.push({
            type: 'reasoning-text',
            content: text.trim(),
            index: idx,
          });
        }
      } else if (isToolPart(part)) {
        // Tool call (unified across STDIO, HTTP, and standard transports)
        const normalized = normalizeToolPart(part);
        if (normalized) {
          steps.push({
            type: 'tool',
            content: { ...part, _normalized: normalized }, // Attach normalized data
            index: idx,
          });
        }
      } else if (isReasoningPart(part)) {
        // Native reasoning tokens (some models like Sonnet 3.7, DeepSeek R1)
        if (part.text && part.text.trim()) {
          steps.push({
            type: 'reasoning-text',
            content: part.text.trim(),
            index: idx,
          });
        }
      }
    });

    // Determine if last text is final response or more reasoning
    if (lastTextAfterTools) {
      // If it's substantial (>100 chars), treat as final response
      // Otherwise, it's probably still analysis/reasoning
      const isSubstantial = lastTextAfterTools.text.length > 100;

      if (isSubstantial) {
        final = lastTextAfterTools.text;
      } else {
        // Short text after tools = still reasoning
        steps.push({
          type: 'reasoning-text',
          content: lastTextAfterTools.text,
          index: lastTextAfterTools.index,
        });
      }
    }

    return {
      thinkingSteps: steps,
      finalText: final,
      planPreviews: plans,
    };
  }, [message.parts]);

  const hasThinkingActivity = thinkingSteps.length > 0;

  // DEBUG: Log the state to understand what's happening
  console.log('[MessageItem/DEBUG]', {
    messageId: message.id,
    isStreaming,
    hasThinkingActivity,
    thinkingStepsCount: thinkingSteps.length,
    finalTextLength: finalText?.length || 0,
    partsCount: message.parts?.length || 0,
    partTypes: message.parts?.map((p: any) => p.type) || []
  });

  // Determine phase: thinking vs generating vs complete
  // isThinkingPhase: Still executing tools, no response text yet → show "Thinking..."
  // isGeneratingPhase: Tools done, response text coming in → show "Generating..."
  // isComplete: Everything done → show "Thought for X seconds" and final text
  const isThinkingPhase = isStreaming && hasThinkingActivity && !finalText;
  const isGeneratingPhase = isStreaming && finalText && hasThinkingActivity;
  const isComplete = !isStreaming;

  return (
    <div className="message-enter">
      <Message from={message.role}>
        <MessageAvatar
          src={isUser ? '/user-avatar.png' : '/assistant-avatar.png'}
          name={isUser ? 'You' : 'AI'}
        />
        <MessageContent variant="flat">
          {/* Thinking Section - Task-based workflow with aesthetics */}
          {hasThinkingActivity && (
            <div className="not-prose mb-4 rounded-md border border-border bg-card backdrop-blur-sm transition-smooth glow-border">
              <Task className="w-full" defaultOpen={false}>
                <CollapsibleTrigger className="flex w-full items-center gap-2 sm:gap-3 text-muted-foreground text-sm sm:text-base md:text-lg transition-smooth hover:text-foreground p-3 sm:p-4 md:p-5">
                  {(isThinkingPhase || isGeneratingPhase) ? (
                    <Loader2 className="size-5 animate-spin pulse-glow" />
                  ) : (
                    <BrainIcon className="size-5" />
                  )}
                  {isThinkingPhase && <span>Thinking...</span>}
                  {isGeneratingPhase && <span>Generating...</span>}
                  {isComplete && <span>Thought for a few seconds</span>}
                  <ChevronDownIcon className="size-6 ml-auto transition-transform" />
                </CollapsibleTrigger>
              <TaskContent className={cn(
                "border-t border-border p-5 space-y-2",
                "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 outline-none data-[state=closed]:animate-out data-[state=open]:animate-in"
              )}>
                {thinkingSteps.map((step, idx) => {
                  if (step.type === 'reasoning-text') {
                    // Determine task type from content
                    const content = step.content.toLowerCase();
                    let prefix = 'Thinking';
                    let prefixColor = 'text-muted-foreground';

                    if (content.includes('plan') || content.includes('need to') || content.includes('will')) {
                      prefix = 'Planning';
                      prefixColor = 'text-foreground/70';
                    } else if (content.includes('result') || content.includes('data shows') || content.includes('analyzing')) {
                      prefix = 'Analyzing';
                      prefixColor = 'text-foreground/70';
                    } else if (content.includes('craft') || content.includes('create') || content.includes('generating')) {
                      prefix = 'Generating';
                      prefixColor = 'text-foreground/70';
                    }

                    return (
                      <TaskItem key={`thinking-${idx}`} className="flex gap-2">
                        <span className="text-muted-foreground/40 select-none shrink-0">→</span>
                        <div>
                          <span className={cn("text-xs font-semibold", prefixColor)}>{prefix}:</span>
                          <span className="text-sm text-muted-foreground ml-2">
                            {step.content.substring(0, 150)}
                            {step.content.length > 150 && '...'}
                          </span>
                        </div>
                      </TaskItem>
                    );
                  }

                  if (step.type === 'tool') {
                    const tool = step.content;
                    // Use normalized tool data (unified across all transports)
                    const normalized: NormalizedToolPart = tool._normalized;
                    const toolName = normalized.toolName;
                    const toolState = normalized.state;
                    const toolResult = normalized.result;
                    const hasError = tool.errorText || (toolResult && (toolResult as any).error) || (toolResult && (toolResult as any).isError);

                    return (
                      <TaskItem key={`tool-${idx}`} className="space-y-1">
                        <div className="text-xs text-foreground/70 font-semibold">
                          Tool Execution
                        </div>
                        <div className="pl-3">
                          <Tool defaultOpen={hasError ? true : false}>
                            <ToolHeader
                              title={toolName}
                              type={tool.type || 'tool-call'}
                              state={toolState}
                            />
                            <ToolContentComponent>
                              {normalized.args && Object.keys(normalized.args).length > 0 && (
                                <ToolInput input={normalized.args} />
                              )}

                              {/* Error Display */}
                              {hasError && (
                                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 mt-2">
                                  <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                    Tool Execution Failed
                                  </div>
                                  <p className="text-sm text-destructive/80 mt-1 font-mono">
                                    {tool.errorText || (toolResult as any)?.error || 'Unknown error occurred'}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-2">
                                    You can ask me to retry this analysis with different parameters or approach.
                                  </p>
                                </div>
                              )}

                              {/* Regular Output */}
                              {!hasError && (toolResult || tool.errorText) && (
                                <ToolOutput
                                  output={toolResult}
                                  errorText={tool.errorText}
                                />
                              )}
                            </ToolContentComponent>
                          </Tool>
                        </div>
                      </TaskItem>
                    );
                  }

                  return null;
                })}
              </TaskContent>
            </Task>
          </div>
        )}

        {/* Plan Previews - Show inline collapsed plan cards */}
        {planPreviews.length > 0 && (
          <div className="space-y-4">
            {planPreviews.map((plan, idx) => (
              <PlanPreview
                key={`plan-preview-${message.id}-${idx}`}
                title={plan.title}
                description={plan.description}
                content={plan.content}
                isStreaming={isStreaming}
                onBuild={() => onPlanBuild?.(plan.content)}
              />
            ))}
          </div>
        )}

        {/* Final Response - Only show when streaming is complete */}
        {isComplete && finalText && (
          <Response className="mt-4">{finalText}</Response>
        )}
      </MessageContent>
    </Message>
    </div>
  );
});
