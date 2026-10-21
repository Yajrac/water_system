// Public API URL only. Native devices cannot reach a computer's localhost.
const baseUrl = (
  process.env.EXPO_PUBLIC_API_URL || 'https://water-system-1.onrender.com/api/v1'
).replace(/\/$/, '');

export async function consumerRequest<T>(path: string, body: unknown, token?: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(baseUrl + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.success !== true) {
      throw new Error(result?.message || 'Request failed. Please try again.');
    }
    return result.data as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('The server took too long to respond. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
