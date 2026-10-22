// Public API URL only. Native devices cannot reach a computer's localhost.
const baseUrl = (
  process.env.EXPO_PUBLIC_API_URL || 'https://water-system-1.onrender.com/api/v1'
).replace(/\/$/, '');

export async function consumerRequest<T>(path: string, body: unknown, token?: string, method: 'GET' | 'POST' = 'POST'): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(baseUrl + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      body: method === 'GET' ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.success !== true) {
      const message = response.status >= 500
        ? 'This service is temporarily unavailable. Please try again shortly.'
        : response.status === 404
          ? 'This service is currently unavailable. Please try again later.'
          : result?.message || 'Your request could not be completed. Please try again.';
      throw new Error(message);
    }
    return result.data as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Connecting is taking longer than usual. Please try again.');
    }
    if (error instanceof TypeError) {
      throw new Error('Unable to connect. Check your internet connection and try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
