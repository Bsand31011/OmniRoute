import {
  clearRecoveredProviderState,
  getProviderCredentialsWithQuotaPreflight,
} from "@/sse/services/auth";
import {
  isAllRateLimitedCredentials,
  rateLimitedProviderResponse,
} from "@/app/api/v1/_shared/rateLimit";
<<<<<<< HEAD
import {
  buildErrorBody,
  sanitizeErrorMessage,
} from "@omniroute/open-sse/utils/error.ts";
import { CORS_HEADERS, handleCorsOptions } from "@/shared/utils/cors";
=======
import { buildErrorBody, sanitizeErrorMessage } from "@omniroute/open-sse/utils/error.ts";
import { CORS_HEADERS, handleCorsOptions } from "@/shared/utils/cors";
import { enforceApiKeyPolicy } from "@/shared/utils/apiKeyPolicy";
import {
  isKeyScopeBlockedCredentials,
  keyScopeBlockedResponse,
  resolveKeyConnectionScope,
} from "@/sse/services/keyConnectionScope";
>>>>>>> upstream/main

const ELEVENLABS_API_BASE = "https://api.elevenlabs.io/v1";
const ALLOWED_RESPONSE_HEADERS = [
  "content-type",
  "content-disposition",
  "request-id",
  "retry-after",
<<<<<<< HEAD
=======
  "character-cost",
  "song-id",
>>>>>>> upstream/main
] as const;

type ElevenLabsCredentials = {
  apiKey?: string | null;
  accessToken?: string | null;
  allExpired?: boolean;
};

export function elevenLabsOptionsResponse(): Response {
  return handleCorsOptions();
}

export function isSafeElevenLabsVoiceId(value: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(value);
}

function proxyResponseHeaders(upstream: Response): Headers {
  const headers = new Headers(CORS_HEADERS);
  for (const name of ALLOWED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

export async function proxyElevenLabsRequest(
  request: Request,
  pathname: string,
<<<<<<< HEAD
  init: Omit<RequestInit, "headers"> = {}
): Promise<Response> {
  const credentials = (await getProviderCredentialsWithQuotaPreflight(
    "elevenlabs"
  )) as ElevenLabsCredentials | null;
=======
  init: Omit<RequestInit, "headers"> = {},
  options: { model?: string; contentType?: string } = {}
): Promise<Response> {
  const policy = await enforceApiKeyPolicy(request, options.model ?? null);
  if (policy.rejection) return policy.rejection;
  // GHSA-3w2r: the ElevenLabs connection must be one the caller key may use.
  const scope = await resolveKeyConnectionScope(policy.apiKeyInfo);
  if (scope.rejection) return scope.rejection;

  const selection = await getProviderCredentialsWithQuotaPreflight(
    "elevenlabs",
    null,
    scope.allowedConnections
  );
  if (isKeyScopeBlockedCredentials(selection)) {
    return keyScopeBlockedResponse("elevenlabs", selection);
  }
  const credentials = selection as ElevenLabsCredentials | null;
>>>>>>> upstream/main
  if (credentials && isAllRateLimitedCredentials(credentials)) {
    return rateLimitedProviderResponse("elevenlabs", credentials);
  }
  const apiKey = credentials?.apiKey || credentials?.accessToken;
  if (!apiKey || credentials?.allExpired) {
    return new Response(
      JSON.stringify(buildErrorBody(401, "No credentials for provider: elevenlabs")),
      {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }

  const incomingUrl = new URL(request.url);
  const upstreamUrl = new URL(`${ELEVENLABS_API_BASE}${pathname}`);
  upstreamUrl.search = incomingUrl.search;
  const headers = new Headers();
  headers.set("xi-api-key", apiKey);
<<<<<<< HEAD
  const contentType = request.headers.get("content-type");
=======
  const contentType = options.contentType ?? request.headers.get("content-type");
>>>>>>> upstream/main
  if (contentType) headers.set("content-type", contentType);
  const accept = request.headers.get("accept");
  if (accept) headers.set("accept", accept);

  try {
<<<<<<< HEAD
    const upstream = await fetch(upstreamUrl, { ...init, headers });
=======
    const upstream = await fetch(upstreamUrl, { ...init, headers, signal: request.signal });
>>>>>>> upstream/main
    if (upstream.ok) {
      await clearRecoveredProviderState(credentials as Record<string, unknown>);
    }
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: proxyResponseHeaders(upstream),
    });
  } catch (error) {
    return new Response(
      JSON.stringify(
        buildErrorBody(
          502,
<<<<<<< HEAD
          sanitizeErrorMessage(
            error instanceof Error ? error.message : "ElevenLabs request failed"
          )
=======
          sanitizeErrorMessage(error instanceof Error ? error.message : "ElevenLabs request failed")
>>>>>>> upstream/main
        )
      ),
      {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }
}
