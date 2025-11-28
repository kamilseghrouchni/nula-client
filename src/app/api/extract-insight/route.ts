import { NextResponse } from 'next/server';
import { extractInsightFromResponse } from '@/lib/workflow/insightExtractor';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const { responseText, phase } = await request.json();

    if (!responseText || typeof responseText !== 'string') {
      return NextResponse.json(
        { error: 'responseText is required' },
        { status: 400 }
      );
    }

    if (!phase || typeof phase !== 'string') {
      return NextResponse.json(
        { error: 'phase is required' },
        { status: 400 }
      );
    }

    const insight = await extractInsightFromResponse(responseText, phase);

    return NextResponse.json({ insight });
  } catch (error: unknown) {
    console.error('[Extract Insight Error]:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to extract insight';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
