export function jsonResponse(
  body: unknown,
  init?: ResponseInit & { headers?: Record<string, string> }
): Response {
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return new Response(JSON.stringify(body), { ...init, headers });
}

export async function readJsonBody<T extends Record<string, unknown>>(
  request: Request
): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

export function getCookie(request: Request, name: string): string | undefined {
  const raw = request.headers.get('cookie');
  if (!raw) return undefined;
  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}
