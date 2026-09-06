import { ApiError } from "./http.js";

/**
 * Turns an unknown thrown value into text a model can act on.
 *
 * Tool handlers return this in `content` with `isError: true` instead of
 * throwing — a thrown error becomes an opaque protocol error, while a returned
 * error tells the model what to do next.
 */
export function toUserMessage(error: unknown, context: string): string {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 401:
        return `Error: ${context} failed — the API key was rejected. Check that EXAMPLE_API_KEY is valid.`;
      case 403:
        return `Error: ${context} failed — access denied. The API key lacks permission for this resource.`;
      case 404:
        return `Error: ${context} failed — not found. Check the identifier and try again.`;
      case 429:
        return `Error: ${context} failed — rate limited. Wait before retrying, or lower the request rate.`;
      default:
        return error.status
          ? `Error: ${context} failed with HTTP ${error.status}. ${error.message}`
          : `Error: ${context} failed. ${error.message}`;
    }
  }
  return `Error: ${context} failed unexpectedly: ${error instanceof Error ? error.message : String(error)}`;
}
