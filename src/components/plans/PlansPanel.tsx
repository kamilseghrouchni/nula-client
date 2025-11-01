"use client";

import { useEffect } from "react";
import ReactMarkdown from "react-markdown";
import {
  Plan,
  PlanCard,
  PlanHeader,
  PlanTitle,
  PlanDescription,
  PlanTrigger,
  PlanContent,
  PlanFooter,
  PlanAction,
} from "@/components/ai-elements/plan";
import { Button } from "@/components/ui/button";
import type { Plan as PlanType } from "@/lib/types";
import { FileText, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PlansPanelProps {
  plans: PlanType[];
  onClose?: () => void;
  onBuild?: (planId: string) => void;
}

export function PlansPanel({ plans, onClose, onBuild }: PlansPanelProps) {
  const handleBuild = (planId: string) => {
    if (onBuild) {
      onBuild(planId);
    }
  };

  const handleClear = (planId: string) => {
    // Clear functionality - for now just log it
    // This could be expanded to clear the plan from state
    console.log('[Plans] Clear plan:', planId);
  };

  const isEmpty = plans.length === 0;
  const planCount = plans.length;

  // Keyboard shortcut handler for Cmd+Enter
  // Only trigger for the most recent plan (last in array)
  useEffect(() => {
    if (!onBuild || plans.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        const latestPlan = plans[plans.length - 1];
        console.log('[PlansPanel] Cmd+Enter triggered for plan:', latestPlan.id);
        handleBuild(latestPlan.id);
      }
    };

    // Add listener to document so it works globally
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onBuild, plans, handleBuild]);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-3 sm:p-4 border-b flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Sparkles className="text-primary flex-shrink-0" size={20} />
          <h2 className="text-sm sm:text-base font-semibold truncate">
            Plans
          </h2>
          {!isEmpty && (
            <Badge variant="secondary" className="ml-2">
              {planCount}
            </Badge>
          )}
        </div>
      </div>

      {/* Content */}
      {isEmpty ? (
        // Empty state
        <div className="flex flex-col items-center justify-center flex-1 text-center p-6">
          <FileText className="text-muted-foreground mb-4" size={48} />
          <h3 className="text-lg font-semibold mb-2">No Plans Yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            When you ask for a plan or strategy, it will appear here with all
            the details.
          </p>
        </div>
      ) : (
        // Plans list
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hidden">
          {plans.map((plan, idx) => (
            <PlanCard key={plan.id}>
              <Plan defaultOpen={idx === plans.length - 1}>
                <PlanHeader>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <PlanTitle>{plan.title}</PlanTitle>
                      {plan.isStreaming && (
                        <Badge variant="outline" className="text-xs">
                          <span className="animate-pulse">Generating...</span>
                        </Badge>
                      )}
                    </div>
                    {plan.description && (
                      <PlanDescription>{plan.description}</PlanDescription>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(plan.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <PlanTrigger />
                </PlanHeader>
                <PlanContent>
                  <div className="prose prose-sm dark:prose-invert max-w-none
                    prose-headings:font-bold prose-headings:tracking-tight
                    prose-h1:text-2xl prose-h1:mt-8 prose-h1:mb-4 prose-h1:text-primary prose-h1:border-b prose-h1:border-border prose-h1:pb-2
                    prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4 prose-h2:text-foreground
                    prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3 prose-h3:text-foreground
                    prose-p:text-sm prose-p:leading-7 prose-p:my-4 prose-p:text-muted-foreground
                    prose-ul:my-4 prose-ul:space-y-2
                    prose-ol:my-4 prose-ol:space-y-2
                    prose-li:text-sm prose-li:leading-7 prose-li:text-foreground prose-li:my-1.5
                    prose-strong:font-bold prose-strong:text-foreground
                    prose-code:bg-muted prose-code:text-primary prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
                    prose-pre:bg-muted prose-pre:border prose-pre:border-border
                    [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6">
                    <ReactMarkdown>{plan.content}</ReactMarkdown>
                  </div>
                </PlanContent>
                <PlanFooter>
                  <PlanAction>
                    <Button size="sm" variant="secondary" onClick={() => handleClear(plan.id)}>
                      Clear
                    </Button>
                    <Button size="sm" onClick={() => handleBuild(plan.id)}>
                      Build <kbd className="ml-1.5 font-mono text-xs">⌘↩</kbd>
                    </Button>
                  </PlanAction>
                </PlanFooter>
              </Plan>
            </PlanCard>
          ))}
        </div>
      )}
    </div>
  );
}
