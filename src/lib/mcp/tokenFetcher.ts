/**
 * Fetch authentication token for Sleepyrat MCP server
 */
export async function fetchSleepyratToken(): Promise<string> {
  // Check if token is already in environment
  const envToken = process.env.SLEEPYRAT_TOKEN;
  if (envToken) {
    console.log('[Sleepyrat] Using token from environment variable');
    return envToken;
  }

  // Otherwise, fetch token using credentials from environment
  const username = process.env.SLEEPYRAT_USERNAME;
  const password = process.env.SLEEPYRAT_PASSWORD;

  if (!username || !password) {
    throw new Error(
      'Sleepyrat credentials not found. Set SLEEPYRAT_TOKEN or (SLEEPYRAT_USERNAME + SLEEPYRAT_PASSWORD) in .env'
    );
  }

  try {
    const response = await fetch('https://sleepyrat.ai/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        password,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch token: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.access_token) {
      throw new Error('No access_token in response');
    }

    console.log('[Sleepyrat] Token fetched successfully');
    return data.access_token;
  } catch (error) {
    console.error('[Sleepyrat] Failed to fetch token:', error);
    throw new Error(`Sleepyrat token fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
