/**
 * Minimal HTTP client for the wrapped API.
 *
 * Native `fetch` keeps the dependency surface small; swap in your vendor SDK
 * here if it ships one (this is the seam a wrapped library plugs into).
 */

/** Error raised for a failed API call, carrying enough context to explain it. */
export class ApiError extends Error {
  /** HTTP status when the failure came from a response (absent for network errors). */
  readonly status?: number;
  /** Response body, truncated, when the server sent one. */
  readonly body?: string;

  constructor(
    message: string,
    options: { status?: number; body?: string; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "ApiError";
    this.status = options.status;
    this.body = options.body;
  }
}

export interface ApiRequestOptions {
  /** Base URL, e.g. `https://api.example.com/v1`. */
  baseUrl: string;
  /** Bearer/API key sent as `Authorization`. Omit for unauthenticated calls. */
  apiKey?: string | undefined;
  /** Path relative to `baseUrl`, e.g. `/items`. */
  path: string;
  /** Query parameters; `undefined` values are dropped. */
  query?: Record<string, string | number | boolean | undefined>;
  /** Abort the request after this many milliseconds. */
  timeoutMs?: number;
  /** Override the fetch implementation (tests). */
  fetchImpl?: typeof fetch;
}

/**
 * Performs a JSON API request and returns the parsed body.
 *
 * @throws {ApiError} on any transport, timeout, or non-2xx response.
 */
export async function apiRequest<T>(options: ApiRequestOptions): Promise<T> {
  const { baseUrl, apiKey, path, query, timeoutMs, fetchImpl } = options;
  const url = new URL(`${baseUrl.replace(/\/$/, "")}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const doFetch = fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await doFetch(url, {
      headers: {
        accept: "application/json",
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      },
      signal: AbortSignal.timeout(timeoutMs ?? 30_000),
    });
  } catch (error) {
    if (isTimeout(error)) {
      throw new ApiError(`Request timed out after ${timeoutMs ?? 30_000}ms`, {
        cause: error,
      });
    }
    throw new ApiError(`Network request failed: ${describe(error)}`, {
      cause: error,
    });
  }

  const text = await response.text();
  if (!response.ok) {
    throw new ApiError(`API request failed with status ${response.status}`, {
      status: response.status,
      body: text.slice(0, 500),
    });
  }

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new ApiError("API returned a non-JSON response", {
      body: text.slice(0, 500),
      cause: error,
    });
  }
}

function isTimeout(error: unknown): boolean {
  return (
    (error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")) ||
    (error instanceof DOMException && error.name === "TimeoutError")
  );
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
