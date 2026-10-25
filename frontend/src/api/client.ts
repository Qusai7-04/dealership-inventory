export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ClientOptions {
  baseUrl?: string;
  getToken?: () => string | null;
  onUnauthorized?: () => void;
  fetcher?: typeof fetch;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

export function createApiClient(options: ClientOptions = {}) {
  const baseUrl = (options.baseUrl ?? '').replace(/\/$/, '');
  const fetcher = options.fetcher ?? fetch;

  async function request<T>(path: string, requestOptions: RequestOptions = {}): Promise<T> {
    const token = options.getToken?.();
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(requestOptions.body !== undefined && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(requestOptions.headers as Record<string, string> | undefined),
    };

    let response: Response;
    try {
      response = await fetcher(`${baseUrl}${path}`, {
        ...requestOptions,
        headers,
        body: requestOptions.body === undefined ? undefined : JSON.stringify(requestOptions.body),
      });
    } catch (error) {
      throw new ApiError(0, 'Unable to reach the server', error);
    }

    const text = response.status === 204 ? '' : await response.text();
    let payload: unknown;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        throw new ApiError(response.ok ? 502 : response.status, 'The server returned an invalid response');
      }
    }

    if (!response.ok) {
      if (response.status === 401) options.onUnauthorized?.();
      const message = payload && typeof payload === 'object' && 'error' in payload &&
        typeof payload.error === 'string' ? payload.error : `Request failed (${response.status})`;
      throw new ApiError(response.status, message, payload);
    }

    return payload as T;
  }

  return {
    request,
    get: <T>(path: string) => request<T>(path),
    post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body }),
    put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body }),
    patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body }),
    delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
