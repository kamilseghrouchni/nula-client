import fs from 'fs';
import path from 'path';

export interface CachedPlan {
  id: string;
  sessionId: string;
  timestamp: number;
  planText: string;
  toolsUsed: string[];
  userQuery: string;
  status: 'pending' | 'in_progress' | 'completed';
}

// Plans directory
const PLANS_DIR = path.join(process.cwd(), 'data', 'plans');

/**
 * Ensure plans directory exists
 */
function ensurePlansDirectory() {
  if (!fs.existsSync(PLANS_DIR)) {
    fs.mkdirSync(PLANS_DIR, { recursive: true });
  }
}

/**
 * Generate plan filename
 */
function getPlanFilename(sessionId: string, timestamp: number): string {
  return `${sessionId}-${timestamp}.json`;
}

/**
 * Save a plan to file system
 */
export function savePlan(plan: CachedPlan): void {
  try {
    ensurePlansDirectory();

    const filename = getPlanFilename(plan.sessionId, plan.timestamp);
    const filepath = path.join(PLANS_DIR, filename);

    fs.writeFileSync(filepath, JSON.stringify(plan, null, 2), 'utf-8');
  } catch (error) {
    console.error('[Plan Cache] Error saving plan:', error);
  }
}

/**
 * Load all plans for a session
 */
export function getPlans(sessionId: string): CachedPlan[] {
  try {
    ensurePlansDirectory();

    const files = fs.readdirSync(PLANS_DIR);
    const sessionFiles = files.filter(file =>
      file.startsWith(`${sessionId}-`) && file.endsWith('.json')
    );

    const plans: CachedPlan[] = [];

    for (const file of sessionFiles) {
      try {
        const filepath = path.join(PLANS_DIR, file);
        const content = fs.readFileSync(filepath, 'utf-8');
        const plan: CachedPlan = JSON.parse(content);
        plans.push(plan);
      } catch (error) {
        console.error(`[Plan Cache] Error loading plan file ${file}:`, error);
      }
    }

    // Sort by timestamp (newest first)
    plans.sort((a, b) => b.timestamp - a.timestamp);

    return plans;
  } catch (error) {
    console.error('[Plan Cache] Error loading plans:', error);
    return [];
  }
}

/**
 * Get the most recent plan for a session
 */
export function getLatestPlan(sessionId: string): CachedPlan | null {
  const plans = getPlans(sessionId);
  return plans.length > 0 ? plans[0] : null;
}

/**
 * Delete old plans (keep last N plans per session)
 */
export function cleanupOldPlans(sessionId: string, keepCount: number = 10): void {
  try {
    const plans = getPlans(sessionId);

    if (plans.length <= keepCount) {
      return; // Nothing to clean up
    }

    const plansToDelete = plans.slice(keepCount);

    for (const plan of plansToDelete) {
      const filename = getPlanFilename(plan.sessionId, plan.timestamp);
      const filepath = path.join(PLANS_DIR, filename);

      try {
        fs.unlinkSync(filepath);
      } catch (error) {
        console.error('[Plan Cache] Error deleting plan:', error);
      }
    }
  } catch (error) {
    console.error('[Plan Cache] Error during cleanup:', error);
  }
}

/**
 * Extract plan text from AI response
 * Detects planning language and extracts the plan
 */
export function extractPlanFromText(text: string): string | null {
  const planIndicators = [
    'plan:',
    'here\'s my plan',
    'i will',
    'i need to',
    'steps:',
    'first, i',
    'the plan is',
  ];

  const lowerText = text.toLowerCase();
  const hasPlanLanguage = planIndicators.some(indicator => lowerText.includes(indicator));

  if (!hasPlanLanguage) {
    return null;
  }

  // Return the full text as the plan if it contains planning language
  // We could do more sophisticated extraction here if needed
  return text.trim();
}

/**
 * Create a plan from step information
 */
export function createPlanFromStep(
  sessionId: string,
  stepText: string,
  toolsUsed: string[],
  userQuery: string
): CachedPlan {
  return {
    id: `plan-${Date.now()}`,
    sessionId,
    timestamp: Date.now(),
    planText: stepText,
    toolsUsed,
    userQuery,
    status: 'pending',
  };
}
