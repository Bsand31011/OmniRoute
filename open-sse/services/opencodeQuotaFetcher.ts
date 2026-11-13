/**
 * OpenCode Go / OpenCode / OpenCode Zen quota fetcher.
 *
 * The official API exposes rolling, weekly, and monthly usage percentages:
 *   GET https://opencode.ai/zen/go/v1/usage
 *   Authorization: Bearer <apiKey>
 *
 * Successful responses are cached for 60 seconds. Network, HTTP, and response
 * parsing failures remain fail-open so quota checks never block on missing data.
 */

import {
  registerQuotaCacheInvalidator,
  registerQuotaFetcher,
  registerQuotaWindows,
  type QuotaInfo,
} from "./quotaPreflight.ts";
import { registerMonitorFetcher } from "./quotaMonitor.ts";
import { throttleQuotaFetch } from "./quotaFetchThrottle.ts";
<<<<<<< HEAD
import { resolveOpenCodeGoDashboardConfig } from "./opencodeOllamaUsage.ts";
=======
import { fetchWithConnectionProxy } from "./connectionProxyFetch.ts";
import { buildOpencodeBackgroundHeaders } from "../utils/opencodeHeaders.ts";
>>>>>>> upstream/main

const OPENCODE_QUOTA_URL =
  process.env.OMNIROUTE_OPENCODE_QUOTA_URL ?? "https://opencode.ai/zen/go/v1/usage";

const CACHE_TTL_MS = 60_000;

// Window keys surfaced to the quota UI and quota-window registry
export const OPENCODE_WINDOW_5H = "window_5h";
export const OPENCODE_WINDOW_WEEKLY = "window_weekly";
export const OPENCODE_WINDOW_MONTHLY = "window_monthly";

// Triple-window quota info
export interface OpencodeTripleWindowQuota extends QuotaInfo {
  window5h: { percentUsed: number; resetAt: string | null };
  windowWeekly: { percentUsed: number; resetAt: string | null };
  windowMonthly: { percentUsed: number; resetAt: string | null };
  limitReached: boolean;
}

interface CacheEntry {
  quota: OpencodeTripleWindowQuota;
  fetchedAt: number;
  apiKey: string;
}

// In-memory cache: connectionId → successful quota bound to its normalized API key
const quotaCache = new Map<string, CacheEntry>();

function normalizeApiKey(connection?: Record<string, unknown>): string {
  return typeof connection?.apiKey === "string"
    ? connection.apiKey
        .trim()
        .replace(/^Bearer\s+/i, "")
        .trim()
    : "";
}

// One-time 404 warning per URL (avoids spamming on every request)
const _warned404Urls = new Set<string>();

/**
 * Reset the 404-warning latch (test-only).
 * Exported for unit tests that want to verify the warning fires on each fresh
 * 404 response.
 */
export function _resetWarned404Urls(): void {
  _warned404Urls.clear();
}

/**
 * Check whether a URL has had its 404 warning already emitted (test-only).
 */
export function _hasWarned404(url: string): boolean {
  return _warned404Urls.has(url);
}

// Auto-cleanup stale entries every 5 minutes
const _cacheCleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of quotaCache) {
    if (now - entry.fetchedAt > CACHE_TTL_MS * 5) {
      quotaCache.delete(key);
    }
  }
}, 5 * 60_000);

if (typeof _cacheCleanup === "object" && "unref" in _cacheCleanup) {
  (_cacheCleanup as { unref?: () => void }).unref?.();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

type ParsedUsageWindow = {
  percentUsed: number;
  resetAt: string;
  limitReached: boolean;
};

function parseUsageWindow(value: unknown): ParsedUsageWindow | null {
  const window = toRecord(value);
  const { status, percent, resetsAt } = window;
  if (
    (status !== "ok" && status !== "rate-limited") ||
    typeof percent !== "number" ||
    !Number.isFinite(percent) ||
    percent < 0 ||
    percent > 100 ||
    typeof resetsAt !== "string" ||
    !resetsAt ||
    !Number.isFinite(Date.parse(resetsAt))
  ) {
    return null;
  }

  return {
    percentUsed: status === "rate-limited" ? 1 : percent / 100,
    resetAt: resetsAt,
    limitReached: status === "rate-limited" || percent === 100,
  };
}

function parseOpencodeQuotaResponse(data: unknown): OpencodeTripleWindowQuota | null {
  const usage = toRecord(toRecord(data).usage);
  const rolling = parseUsageWindow(usage.rolling);
  const weekly = parseUsageWindow(usage.weekly);
  const monthly = parseUsageWindow(usage.monthly);
  if (!rolling || !weekly || !monthly) return null;

  const window5h = { percentUsed: rolling.percentUsed, resetAt: rolling.resetAt };
  const windowWeekly = { percentUsed: weekly.percentUsed, resetAt: weekly.resetAt };
  const windowMonthly = { percentUsed: monthly.percentUsed, resetAt: monthly.resetAt };
  const worstPercent = Math.max(
    window5h.percentUsed,
    windowWeekly.percentUsed,
    windowMonthly.percentUsed
  );
  const dominantResetAt =
    worstPercent === window5h.percentUsed
      ? window5h.resetAt
      : worstPercent === windowWeekly.percentUsed
        ? windowWeekly.resetAt
        : windowMonthly.resetAt;

  return {
    used: worstPercent * 100,
    total: 100,
    percentUsed: worstPercent,
    resetAt: dominantResetAt,
    windows: {
      [OPENCODE_WINDOW_5H]: window5h,
      [OPENCODE_WINDOW_WEEKLY]: windowWeekly,
      [OPENCODE_WINDOW_MONTHLY]: windowMonthly,
    },
    window5h,
    windowWeekly,
    windowMonthly,
    limitReached: rolling.limitReached || weekly.limitReached || monthly.limitReached,
  };
}

// ─── Core Fetcher ─────────────────────────────────────────────────────────────
<<<<<<< HEAD

// ─── Dashboard Snapshot Bridge (#11234) ───────────────────────────────────────
//
// The live endpoint above has no public quota API today (404 — see module
// JSDoc), so without this bridge every preflight evaluated `null` and
// proceeded (fail-open) even when the dashboard already showed a drained
// window. The dashboard scrape (`getOpenCodeGoUsage` in
// opencodeOllamaUsage.ts) persists per-window snapshots through
// `src/domain/quotaCache.ts::setQuotaCache` under the window keys
// session / weekly / mcp_monthly; this bridge synthesizes the same
// OpencodeTripleWindowQuota shape from those cached snapshots so the quota
// cutoff sees them.
//
// Read-only: accessors only, never SQL, never a re-scrape on the hot path.
// Fail-open is preserved — no snapshots means `null`, exactly as before.

// Dashboard snapshot key → fetcher/preflight window key.
const DASHBOARD_SNAPSHOT_WINDOW_MAP: ReadonlyArray<readonly [string, string]> = [
  ["session", OPENCODE_WINDOW_5H],
  ["weekly", OPENCODE_WINDOW_WEEKLY],
  ["mcp_monthly", OPENCODE_WINDOW_MONTHLY],
];

function hasDashboardQuotaConfig(connection?: Record<string, unknown>): boolean {
  // Snapshots can only exist when the operator configured the dashboard
  // scrape for this connection (or globally via env). Gating on it keeps the
  // snapshot read (and its cold-start DB hydration) off connections that
  // could never have produced one.
  const psd = connection?.providerSpecificData as Record<string, unknown> | undefined;
  return resolveOpenCodeGoDashboardConfig(psd).state !== "none";
}

async function synthesizeQuotaFromDashboardSnapshots(
  connectionId: string
): Promise<OpencodeTripleWindowQuota | null> {
  let quotaCacheDomain: typeof import("../../src/domain/quotaCache.ts");
  try {
    // Dynamic import: a static edge would close an initialization cycle
    // (opencodeQuotaFetcher → quotaCache → usage.ts → usage/opencode.ts →
    // opencodeQuotaFetcher).
    quotaCacheDomain = await import("../../src/domain/quotaCache.ts");
  } catch {
    return null;
  }

  // Hydrate the in-memory cache from persisted snapshots when cold (the
  // accessor does this internally), then read the raw per-window rows.
  quotaCacheDomain.getQuotaWindowStatus(connectionId, DASHBOARD_SNAPSHOT_WINDOW_MAP[0][0]);
  const entry = quotaCacheDomain.getQuotaCache(connectionId);
  const quotas = entry?.quotas;
  if (!quotas || typeof quotas !== "object") return null;

  const now = Date.now();
  const windows: Record<string, { percentUsed: number; resetAt: string | null }> = {};

  for (const [snapshotKey, windowKey] of DASHBOARD_SNAPSHOT_WINDOW_MAP) {
    const raw = quotas[snapshotKey];
    if (!raw || typeof raw.remainingPercentage !== "number") continue;
    // #10095 mirror: a window whose fraction upstream never reported is
    // "unknown", not 0% — it must not count as exhausted.
    if (raw.fractionReported === false) continue;
    const resetAt = typeof raw.resetAt === "string" && raw.resetAt ? raw.resetAt : null;
    if (resetAt) {
      const resetMs = Date.parse(resetAt);
      // Mirror getQuotaWindowStatus (quotaCache.ts): an expired resetAt means
      // the window has rolled into a fresh period — the cached percentage is
      // stale and must not count as exhausted.
      if (Number.isFinite(resetMs) && resetMs <= now) continue;
    }
    const remaining = Math.max(0, Math.min(100, raw.remainingPercentage));
    windows[windowKey] = { percentUsed: 1 - remaining / 100, resetAt };
  }

  if (Object.keys(windows).length === 0) return null;

  const window5h = windows[OPENCODE_WINDOW_5H] ?? { percentUsed: 0, resetAt: null };
  const windowWeekly = windows[OPENCODE_WINDOW_WEEKLY] ?? { percentUsed: 0, resetAt: null };
  const windowMonthly = windows[OPENCODE_WINDOW_MONTHLY] ?? { percentUsed: 0, resetAt: null };

  const worstPercent = Math.max(
    window5h.percentUsed,
    windowWeekly.percentUsed,
    windowMonthly.percentUsed
  );

  // Dominant reset: pick the window with the worst usage (same policy as the
  // live-response parser above).
  let dominantResetAt: string | null = null;
  if (worstPercent === window5h.percentUsed) {
    dominantResetAt = window5h.resetAt ?? windowWeekly.resetAt ?? windowMonthly.resetAt;
  } else if (worstPercent === windowWeekly.percentUsed) {
    dominantResetAt = windowWeekly.resetAt ?? window5h.resetAt ?? windowMonthly.resetAt;
  } else {
    dominantResetAt = windowMonthly.resetAt ?? windowWeekly.resetAt ?? window5h.resetAt;
  }

  return {
    used: worstPercent * 100,
    total: 100,
    percentUsed: worstPercent,
    resetAt: dominantResetAt,
    windows,
    window5h,
    windowWeekly,
    windowMonthly,
    limitReached: worstPercent >= 1,
  };
}

=======
>>>>>>> upstream/main
/**
 * Fetch current quota for an OpenCode connection.
 * Returns null on missing credentials, HTTP errors, malformed responses, and
 * network failures so callers preserve fail-open behavior.
 */
export async function fetchOpencodeQuota(
  connectionId: string,
  connection?: Record<string, unknown>
): Promise<OpencodeTripleWindowQuota | null> {
<<<<<<< HEAD
  // Snapshots can only exist when the dashboard scrape is configured for this
  // connection (or globally via env); without it the bridge stays off and the
  // fetcher never touches the snapshot store.
  const dashboardConfigured = hasDashboardQuotaConfig(connection);

  // Check cache first
  const cached = quotaCache.get(connectionId);
  if (cached) {
    // 404 sentinel — use longer TTL to avoid hammering a non-existent endpoint
    if (cached.noEndpoint && Date.now() - cached.fetchedAt < NO_ENDPOINT_TTL_MS) {
      // The live endpoint is known-absent — serve dashboard snapshots if the
      // operator configured the scrape (#11234).
      return dashboardConfigured ? synthesizeQuotaFromDashboardSnapshots(connectionId) : null;
    }
    if (cached.quota !== null && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.quota;
    }
  }

  const live = await fetchLiveOpencodeQuota(connectionId, connection);
  if (live) return live;

  // #11234 — the live endpoint has no public quota API (404) or failed:
  // fall back to the operator-configured dashboard snapshots, read-only.
  return dashboardConfigured ? synthesizeQuotaFromDashboardSnapshots(connectionId) : null;
}

async function fetchLiveOpencodeQuota(
  connectionId: string,
  connection?: Record<string, unknown>
): Promise<OpencodeTripleWindowQuota | null> {
  // Extract API key from connection
  const apiKey =
    typeof connection?.apiKey === "string" && connection.apiKey.trim().length > 0
      ? connection.apiKey
      : null;

  if (!apiKey) {
    return null;
=======
  const apiKey = normalizeApiKey(connection);
  if (!apiKey) return null;

  const cached = quotaCache.get(connectionId);
  if (cached && cached.apiKey === apiKey && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.quota;
>>>>>>> upstream/main
  }

  try {
    await throttleQuotaFetch();
    const response = await fetchWithConnectionProxy(connectionId, OPENCODE_QUOTA_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        // OpenCode operator warning: background calls on the bare runtime UA
        // ("Bun fetch") without x-opencode-session are flagged, with hard
        // errors announced from 2026-09-06. Send the CLI identity + a stable
        // per-connection session fingerprint (see buildOpencodeBackgroundHeaders).
        ...buildOpencodeBackgroundHeaders({ seed: connectionId }),
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response) return null;

    if (!response.ok) {
      if (response.status === 404 && !_warned404Urls.has(OPENCODE_QUOTA_URL)) {
        _warned404Urls.add(OPENCODE_QUOTA_URL);
        console.warn(
          `[opencodeQuotaFetcher] Official usage endpoint ${OPENCODE_QUOTA_URL} returned 404. ` +
            "Verify OMNIROUTE_OPENCODE_QUOTA_URL when using a relay or test server."
        );
      }
      if (response.status === 401 || response.status === 403) quotaCache.delete(connectionId);
      return null;
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      return null;
    }

    const quota = parseOpencodeQuotaResponse(data);
    if (!quota) return null;

    quotaCache.set(connectionId, { quota, fetchedAt: Date.now(), apiKey });
    return quota;
  } catch {
    return null;
  }
}

// ─── Invalidation ─────────────────────────────────────────────────────────────

/**
 * Force-invalidate the cache for a connection (e.g., after receiving quota headers).
 */
export function invalidateOpencodeQuotaCache(connectionId: string): void {
  quotaCache.delete(connectionId);
}

// ─── Registration ─────────────────────────────────────────────────────────────

/**
 * Register the OpenCode quota fetcher with the preflight and monitor systems
 * for both provider variants: opencode-go, opencode-zen.
 *
 * Call this once at server startup (in chat.ts, before registerGenericQuotaFetchers).
 */
export function registerOpencodeQuotaFetcher(): void {
  for (const provider of ["opencode-go", "opencode-zen"] as const) {
    registerQuotaFetcher(provider, fetchOpencodeQuota);
    registerQuotaCacheInvalidator(provider, invalidateOpencodeQuotaCache);
    registerMonitorFetcher(provider, fetchOpencodeQuota);
    registerQuotaWindows(provider, [
      OPENCODE_WINDOW_5H,
      OPENCODE_WINDOW_WEEKLY,
      OPENCODE_WINDOW_MONTHLY,
    ]);
  }
}
