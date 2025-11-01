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

interface PlanPreviewProps {
  title: string;
  description?: string;
  content: string;
  isStreaming?: boolean;
  onBuild?: () => void;
  onClear?: () => void;
}

export function PlanPreview({
  title,
  description,
  content,
  isStreaming = false,
  onBuild,
  onClear,
}: PlanPreviewProps) {
  // Format content for display (first 3-5 lines or sections)
  const previewContent = formatPreviewContent(content);

  const handleBuild = () => {
    if (onBuild) {
      onBuild();
    }
  };

  const handleClear = () => {
    if (onClear) {
      onClear();
    } else {
      // Default: just log it
      console.log('[PlanPreview] Clear clicked');
    }
  };

  // Keyboard shortcut handler for Cmd+Enter
  useEffect(() => {
    if (!onBuild) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        console.log('[PlanPreview] Cmd+Enter triggered');
        handleBuild();
      }
    };

    // Add listener to document so it works globally
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onBuild, handleBuild]);

  return (
    <div className="my-4 not-prose">
      <PlanCard>
        <Plan isStreaming={isStreaming} defaultOpen={false}>
          <PlanHeader>
            <div className="flex-1 min-w-0 space-y-1">
              <PlanTitle>{title}</PlanTitle>
              {description && <PlanDescription>{description}</PlanDescription>}
              <p className="text-xs text-muted-foreground">
                Click to view full plan in the Plans panel →
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
              <ReactMarkdown>{previewContent}</ReactMarkdown>
              <div className="mt-6 pt-4 border-t border-border text-xs text-muted-foreground italic">
                Click "Plans" tab to see full details →
              </div>
            </div>
          </PlanContent>
          {onBuild && (
            <PlanFooter>
              <PlanAction>
                <Button size="sm" variant="secondary" onClick={handleClear}>
                  Clear
                </Button>
                <Button size="sm" onClick={handleBuild}>
                  Build <kbd className="ml-1.5 font-mono text-xs">⌘↩</kbd>
                </Button>
              </PlanAction>
            </PlanFooter>
          )}
        </Plan>
      </PlanCard>
    </div>
  );
}

// Helper function to get first few lines/sections for preview
function formatPreviewContent(content: string): string {
  const lines = content.split('\n');

  // Take first 10 lines or until we hit 300 characters
  let preview = '';
  let charCount = 0;

  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const line = lines[i];
    if (charCount + line.length > 300) {
      preview += '\n...';
      break;
    }
    preview += (i > 0 ? '\n' : '') + line;
    charCount += line.length;
  }

  return preview || content.substring(0, 300) + '...';
}
