"use client";

import { useState } from "react";
import { WorkflowPanel } from "./workflow/WorkflowPanel";
import { LabNotebook } from "./notebook/LabNotebook";
import { PlansPanel } from "./plans/PlansPanel";
import type { UIMessage, Plan } from "@/lib/types";
import { Network, FlaskConical, Sparkles, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "workflow" | "notebook" | "plans";

interface RightPanelProps {
  messages: UIMessage[];
  artifacts: any[];
  plans: Plan[];
  hasWorkflow: boolean;
  hasArtifacts: boolean;
  hasPlans: boolean;
  initialTab?: Tab;
  onClose?: () => void;
  onPlanBuild?: (planId: string) => void;
}

export function RightPanel({
  messages,
  artifacts,
  plans,
  hasWorkflow,
  hasArtifacts,
  hasPlans,
  initialTab = "workflow",
  onClose,
  onPlanBuild,
}: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  // Count how many content types exist
  const contentCount = [hasWorkflow, hasArtifacts, hasPlans].filter(Boolean).length;

  // If only one type of content, show it with close button
  if (contentCount === 1) {
    return (
      <div className="h-full flex flex-col bg-background border-l border-border">
        {/* Header with close button */}
        <div className="flex items-center justify-end border-b border-border px-2 py-2 flex-shrink-0">
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors rounded"
              aria-label="Close panel"
              title="Hide panel"
            >
              <ChevronRight size={20} />
            </button>
          )}
        </div>
        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {hasWorkflow && <WorkflowPanel messages={messages} />}
          {hasArtifacts && <LabNotebook artifacts={artifacts} />}
          {hasPlans && <PlansPanel plans={plans} onBuild={onPlanBuild} />}
        </div>
      </div>
    );
  }

  // Multiple types exist - show tabbed interface
  return (
    <div className="h-full flex flex-col bg-background border-l border-border">
      {/* Tab Bar */}
      <div className="flex items-center border-b flex-shrink-0">
        {hasPlans && (
          <button
            onClick={() => setActiveTab("plans")}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2",
              activeTab === "plans"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted"
            )}
          >
            <Sparkles size={16} />
            <span>Plans</span>
          </button>
        )}
        {hasWorkflow && (
          <button
            onClick={() => setActiveTab("workflow")}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2",
              activeTab === "workflow"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted"
            )}
          >
            <Network size={16} />
            <span>Workflow</span>
          </button>
        )}
        {hasArtifacts && (
          <button
            onClick={() => setActiveTab("notebook")}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2",
              activeTab === "notebook"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted"
            )}
          >
            <FlaskConical size={16} />
            <span>Lab Notebook</span>
          </button>
        )}
        <div className="flex-1" />
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors rounded mr-1"
            aria-label="Close panel"
            title="Hide panel"
          >
            <ChevronRight size={20} />
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "plans" && <PlansPanel plans={plans} onBuild={onPlanBuild} />}
        {activeTab === "workflow" && <WorkflowPanel messages={messages} />}
        {activeTab === "notebook" && <LabNotebook artifacts={artifacts} />}
      </div>
    </div>
  );
}
