/**
 * Agent Card Endpoint — /.well-known/agent-card.json
 *
 * Serves the OmniRoute A2A Agent Card in the A2A Protocol v1.0 shape for
 * discovery by 1.0 clients (a2a-sdk 1.x, Hermes, …). The legacy v0.3 card
 * remains available at /.well-known/agent.json.
 *
 * `supportedInterfaces` declares both protocol versions against the same
 * JSON-RPC endpoint — the v1.0 route handler accepts both `SendMessage` and
 * the legacy `message/send` (see src/app/a2a/route.ts).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { buildAgentCardMetadata } from "@/lib/a2a/agentCardMetadata";
import { getFleetSkills } from "@/lib/conductor/fleetSkills";
import { getBaseUrl } from "@/lib/wellKnown";
<<<<<<< HEAD

const PACKAGE_VERSION = process.env.npm_package_version || "1.8.1";
=======
>>>>>>> upstream/main

/**
 * GET /.well-known/agent-card.json
 *
 * Returns the OmniRoute Agent Card (A2A v1.0).
 */
<<<<<<< HEAD
export async function GET(request: NextRequest) {
=======
export async function GET(request?: NextRequest) {
>>>>>>> upstream/main
  const fleetSkills = await getFleetSkills();
  const baseUrl = getBaseUrl(request);

  const agentCard = {
<<<<<<< HEAD
    name: "OmniRoute AI Gateway",
    description:
      "Intelligent AI routing gateway with 36+ providers, smart fallback, quota tracking, " +
      "format translation, and auto-managed combos. Routes AI requests to the optimal " +
      "provider based on cost, latency, quota availability, and task requirements.",
    url: `${baseUrl}/a2a`,
    version: PACKAGE_VERSION,
=======
    ...buildAgentCardMetadata(baseUrl, fleetSkills),
>>>>>>> upstream/main
    supportedInterfaces: [
      {
        url: `${baseUrl}/a2a`,
        protocolBinding: "JSONRPC",
        protocolVersion: "1.0",
      },
      {
        url: `${baseUrl}/a2a`,
        protocolBinding: "JSONRPC",
        protocolVersion: "0.3",
      },
    ],
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
    security: {
      schemes: ["api-key"],
      apiKeyHeader: "Authorization",
    },
  };

  return NextResponse.json(agentCard, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "application/json",
    },
  });
}
