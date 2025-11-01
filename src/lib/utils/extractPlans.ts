import type { UIMessage, Plan } from "@/lib/types";

/**
 * Extracts plans from assistant messages
 * Plans can be identified by:
 * 1. <plan>...</plan> tags
 * 2. Messages containing structured planning content (numbered steps, sections)
 */
export function extractPlans(messages: UIMessage[]): Plan[] {
  const allPlans: Plan[] = [];

  // Regex for plan tags (e.g., <plan title="..." description="...">...</plan>)
  const planTagRegex = /<plan(?:\s+title="([^"]*)")?(?:\s+description="([^"]*)")?\s*>([\s\S]*?)<\/plan>/g;

  messages.forEach((message, messageIndex) => {
    if (message.role === 'assistant' && message.parts) {
      message.parts.forEach((part: any, partIdx: number) => {
        // Extract from text-based plan tags
        if (part.type === 'text') {
          const text = part.text || '';

          // Extract from plan tags
          const planMatches: RegExpMatchArray[] = Array.from(text.matchAll(planTagRegex));
          planMatches.forEach((match, idx) => {
            const title = match[1] || `Plan ${allPlans.length + 1}`;
            const description = match[2] || undefined;
            const content = match[3]?.trim() || '';

            allPlans.push({
              id: `plan-${message.id}-${idx}`,
              title,
              description,
              content,
              messageId: message.id,
              messageIndex,
              timestamp: Date.now(),
              isStreaming: false,
            });
          });

          // Also detect plans without explicit tags
          // Look for messages that start with common planning indicators
          if (planMatches.length === 0) {
            const planIndicators = [
              /^##?\s*Plan:/im,
              /^##?\s*Implementation Plan/im,
              /^##?\s*Strategy/im,
              /^##?\s*Approach/im,
            ];

            const hasPlanIndicator = planIndicators.some(regex => regex.test(text));

            // Check for structured content (multiple numbered steps or sections)
            const hasNumberedSteps = /(?:^|\n)\d+\.\s+.+/gm.test(text);
            const hasSections = /(?:^|\n)##\s+.+/gm.test(text);
            const hasSteps = (text.match(/(?:^|\n)[-*]\s+(?:Step|Phase|Task|Action)/gim) || []).length >= 3;

            if (hasPlanIndicator && (hasNumberedSteps || hasSections || hasSteps)) {
              // Extract title from first header or use default
              const titleMatch = text.match(/^##?\s*(.+?)$/m);
              const title = titleMatch ? titleMatch[1].trim() : `Plan ${allPlans.length + 1}`;

              // Try to extract first paragraph as description
              const descriptionMatch = text.match(/^(?:##?\s*.+?\n+)([\s\S]+?)(?:\n\n|$)/);
              const description = descriptionMatch ? descriptionMatch[1].trim().substring(0, 150) : undefined;

              allPlans.push({
                id: `plan-auto-${message.id}`,
                title,
                description,
                content: text,
                messageId: message.id,
                messageIndex,
                timestamp: Date.now(),
                isStreaming: false,
              });
            }
          }
        }
      });
    }
  });

  console.log('[Plans] Extracted count:', allPlans.length);
  if (allPlans.length > 0) {
    console.log('[Plans] Titles:', allPlans.map(p => p.title));
  }

  return allPlans;
}
