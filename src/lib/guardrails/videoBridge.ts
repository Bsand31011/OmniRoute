import { createHash } from "node:crypto";
<<<<<<< HEAD

import { fetch as undiciFetch } from "undici";
=======
>>>>>>> upstream/main

import { getSettings as defaultGetSettings } from "@/lib/db/settings";
import { getResolvedModelCapabilities } from "@/lib/modelCapabilities";
import {
  resolveVideoBridgeRuntimeSettings,
  resolveVisionBridgeRuntimeSettings,
<<<<<<< HEAD
=======
  resolveVideoAudioTranscriptionRuntimeSettings,
>>>>>>> upstream/main
  type VideoAnalysisMode,
} from "@/shared/constants/modalityBridgeDefaults";

import { BaseGuardrail, type GuardrailContext, type GuardrailResult } from "./base";
<<<<<<< HEAD
import {
  bridgeCacheKey,
  getSharedBridgeCacheFor,
  type BridgeCacheEntry,
  type BridgeCacheStore,
} from "./modalityBridge/bridgeCache";
import { recordBridgeUse } from "./modalityBridge/bridgeStats";
import {
  composeVideoFramePrompt,
  describeVideoPart as defaultDescribeVideoPart,
=======
import type { BridgeCacheStore } from "./modalityBridge/bridgeCache";
import {
>>>>>>> upstream/main
  extractVideoFocusHint,
  extractVideoParts,
  loadVideoPartBytes,
  replaceVideoParts,
  resolveVideoDedupCandidateFrameCount,
  VIDEO_BRIDGE_MAX_BYTES,
  VIDEO_DEDUP_MAX_CANDIDATE_FRAMES,
  VIDEO_DEDUP_POLICY_VERSION,
  VIDEO_DEDUP_THRESHOLD,
  type DescribeVideoDependencies,
  type DescribedVideo,
  type VideoFusionTelemetry,
  type VideoPart,
} from "./videoBridgeHelpers";
import {
<<<<<<< HEAD
  getSharedVideoResultCacheFor,
  runVideoDownloadSingleflight,
  runVideoResultSingleflight,
  safeDeleteCacheEntry,
  safeGetCacheEntry,
  safeSetCacheEntry,
  videoBridgeAbortError,
} from "./videoBridgeResultCache";
import {
  callVisionModel as defaultCallVisionModel,
  type VisionModelConfig,
} from "./visionBridgeHelpers";
=======
  combineModelIdentities,
  processVideoPart,
  type ProcessVideoPartDeps,
  type VideoAnalysisContext,
} from "./videoBridgePipeline";
import { getSharedVideoResultCacheFor } from "./videoBridgeResultCache";
import { appendVideoFallbackTranscripts } from "./videoBridgeFallbackTranscript";
import { type VisionModelConfig } from "./visionBridgeHelpers";
>>>>>>> upstream/main
import { getBestVisionModel } from "./visionBridgeRouter";
import { createVideoSttAdapter, type VideoSttAdapterDependencies } from "./videoBridgeSttAdapter";
import {
  resolveVisionBridgeKeyScope,
  scopedCredentialCheck,
  type VisionBridgeKeyScope,
  type VisionBridgeKeyScopeDeps,
} from "./visionBridgeKeyScope";

export type { VideoAnalysisContext } from "./videoBridgePipeline";

/**
 * One replaced video part whose rendered text carried a transcript cue.
 * `redactedText` is the structured-redaction shadow (see
 * `DescribedVideo.descriptionRedacted`) for that same part — never derived
 * from the model-bound text, so it cannot be bypassed by cue content.
 *
 * #12150 fix round 1 (adversarial review): the downstream log-redaction
 * consumer (`applyVideoBridgeLogRedaction`, chatCore/attemptLogging.ts)
 * matches by CONTENT (`fullText`), not by `messageIndex`/`partIndex`.
 * Between this guardrail's preCall and the eventual log write, other
 * request-mutation stages (system-prompt injection when no existing system
 * message is found, context-relay handoff injection, reasoning-rule body
 * rewrites) can prepend/splice messages, silently invalidating any
 * positional index. `messageIndex`/`partIndex` are kept as advisory/
 * debugging metadata only — never used for matching.
 */
export interface VideoBridgeLogRedactionEntry {
  container: "messages" | "input";
  /** Advisory only (see interface doc) — may be stale by the time the log is written. */
  messageIndex: number;
  /** Advisory only (see interface doc) — may be stale by the time the log is written. */
  partIndex: number;
  /**
   * The exact, unredacted text placed into the replaced part
   * (`descriptions[i]`, identical to what `replaceVideoParts` writes to
   * `content[partIndex].text`). The downstream consumer matches parts by
   * `part.text === fullText`, so it finds the video part wherever a later
   * stage moved it, and never touches a part whose text differs.
   */
  fullText: string;
  redactedText: string;
}

/**
 * #12150 P1 final-review fix: re-anchor each redaction entry's `fullText` from
 * the FINAL pre-call guardrail payload. The video-bridge guardrail runs at
 * priority 7, but the PII masker (10) and credential masker (95) rewrite the
 * SAME chained payload afterward, in place — so by the end of the chain the
 * replaced part's text may differ from what video-bridge recorded, and the log
 * sink's content-match (`part.text === fullText`) would miss (fail open). Chain
 * guardrails only rewrite text in place — they never splice the message array —
 * so the advisory `(container, messageIndex, partIndex)` still resolves inside
 * the finished chain payload; reading the part text there yields the true
 * post-chain text the log sink will see. Falls back to the original `fullText`
 * when the index no longer resolves. Returns new entries; never mutates the
 * shared guardrail `meta` array. `redactedText` is unchanged (it is rendered
 * from the structured cues, independent of any masker rewrite).
 */
export function reanchorVideoBridgeRedaction(
  entries: readonly VideoBridgeLogRedactionEntry[],
  finalBody: unknown
): VideoBridgeLogRedactionEntry[] {
  const body = finalBody as Record<string, unknown> | null | undefined;
  return entries.map((entry) => {
    const container = body?.[entry.container];
    if (!Array.isArray(container)) return { ...entry };
    const message = container[entry.messageIndex] as { content?: unknown } | undefined;
    const content = message?.content;
    if (!Array.isArray(content)) return { ...entry };
    const part = content[entry.partIndex] as { text?: unknown } | undefined;
    if (!part || typeof part.text !== "string") return { ...entry };
    return { ...entry, fullText: part.text };
  });
}

type VideoBridgeBody = {
  model?: string;
  messages?: Array<{ role?: string; content?: unknown }>;
  input?: Array<{ role?: string; content?: unknown }>;
  [key: string]: unknown;
};

<<<<<<< HEAD
export interface VideoAnalysisContext {
  /** Effective prompt behavior after the no-text fallback. */
  analysisMode: VideoAnalysisMode;
  /** Canonical, bounded user text. This remains untrusted context. */
  focusHint?: string;
  /** SHA-256 of the canonical hint; raw task text is never stored in cache metadata. */
  focusHintFingerprint: string | null;
  requestedAnalysisMode: VideoAnalysisMode;
}

function combineModelIdentities(models: ReadonlySet<string>, fallback: string): string {
  if (models.size === 0) return fallback;
  if (models.size === 1) return models.values().next().value ?? fallback;
  return "mixed";
}

function safeTranscriptFingerprint(value: unknown): string {
  if (value === undefined) return "";
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return "invalid-transcript";
  }
}

function waitForVideoBridgePromise<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(videoBridgeAbortError());
  return new Promise<T>((resolve, reject) => {
    let completed = false;
    const finish = (callback: () => void): void => {
      if (completed) return;
      completed = true;
      signal.removeEventListener("abort", onAbort);
      callback();
    };
    const onAbort = (): void => finish(() => reject(videoBridgeAbortError()));
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
    promise.then(
      (value) => finish(() => resolve(value)),
      (error: unknown) => finish(() => reject(error))
    );
  });
}

const VIDEO_BRIDGE_RESULT_CACHE_VERSION = "v4";
const VIDEO_BRIDGE_RESULT_CACHE_POLICY = "sampling-then-dedup-v2";
const VIDEO_BRIDGE_RESULT_CACHE_KEY_KIND = "video-result-v4";
const VIDEO_BRIDGE_DOWNLOAD_FLIGHT_VERSION = "v1";

function buildVideoDownloadFlightKey(
  part: VideoPart,
  context: GuardrailContext,
  maxBytes: number,
  timeoutMs: number
): string {
  const rawPrincipalId = context.apiKeyInfo?.id;
  const principalId =
    typeof rawPrincipalId === "string" || typeof rawPrincipalId === "number"
      ? String(rawPrincipalId)
      : "local";
  const canonicalIdentity = JSON.stringify({
    container: part.container,
    endpoint: context.endpoint ?? null,
    maxBytes,
    method: context.method ?? null,
    model: context.model ?? null,
    provider: context.provider ?? null,
    ref: part.ref,
    shape: part.shape,
    sourceFormat: context.sourceFormat ?? null,
    targetFormat: context.targetFormat ?? null,
    timeoutMs,
    version: VIDEO_BRIDGE_DOWNLOAD_FLIGHT_VERSION,
  });
  const requestFingerprint = createHash("sha256").update(canonicalIdentity).digest("hex");
  // The authenticated database id is an ephemeral in-memory scope, not a
  // password or persisted credential. Keep it out of cryptographic hashes so
  // password-hash analysis cannot conflate tenant partitioning with storage.
  return `video-download:${JSON.stringify([principalId, requestFingerprint])}`;
}

interface VideoResultCacheMetadata {
  analysisMode: VideoAnalysisMode;
  cacheVersion: string;
  policyVersion: string;
  extractorVersion: string;
  strategy: string;
  model: string;
  prompt: string;
  frameCount: number;
  maxVideos: number;
  dedupCandidateFrameCount: number;
  dedupPolicyVersion: string;
  dedupThreshold: number;
  durationSeconds: number;
  framesRequested: number;
  framesExtracted: number;
  framesUsed: number;
  dedupDropped?: number;
  focusStartSeconds?: number;
  focusEndSeconds?: number;
  focusHintFingerprint: string | null;
  samplingCandidateCount?: number;
  samplingPolicyEffective?: "uniform" | "scene_aware" | "segment_aware";
  samplingPolicyRequested?: "uniform" | "scene_aware" | "segment_aware";
  transcriptCuesApplied?: number;
  contactSheetUsed?: boolean;
  fusion?: VideoFusionTelemetry;
  cacheBytes: number;
  modelUsed: string;
}

type VideoResultCacheIdentity = Pick<
  VideoResultCacheMetadata,
  | "analysisMode"
  | "cacheVersion"
  | "dedupCandidateFrameCount"
  | "dedupPolicyVersion"
  | "dedupThreshold"
  | "extractorVersion"
  | "frameCount"
  | "focusHintFingerprint"
  | "maxVideos"
  | "model"
  | "policyVersion"
  | "prompt"
  | "strategy"
>;

const VIDEO_RESULT_CACHE_IDENTITY_KEYS: readonly (keyof VideoResultCacheIdentity)[] = [
  "analysisMode",
  "cacheVersion",
  "dedupCandidateFrameCount",
  "dedupPolicyVersion",
  "dedupThreshold",
  "extractorVersion",
  "frameCount",
  "focusHintFingerprint",
  "maxVideos",
  "model",
  "policyVersion",
  "prompt",
  "strategy",
];

function createVideoResultCacheIdentity(
  runtime: ReturnType<typeof resolveVideoBridgeRuntimeSettings>,
  visionRuntime: ReturnType<typeof resolveVisionBridgeRuntimeSettings>,
  model: string,
  analysis: VideoAnalysisContext
): VideoResultCacheIdentity {
  return {
    analysisMode: analysis.analysisMode,
    cacheVersion: VIDEO_BRIDGE_RESULT_CACHE_VERSION,
    dedupCandidateFrameCount: resolveVideoDedupCandidateFrameCount(runtime.frameCount),
    dedupPolicyVersion: VIDEO_DEDUP_POLICY_VERSION,
    dedupThreshold: VIDEO_DEDUP_THRESHOLD,
    extractorVersion: VIDEO_BRIDGE_RESULT_CACHE_VERSION,
    frameCount: runtime.frameCount,
    focusHintFingerprint: analysis.focusHintFingerprint,
    maxVideos: runtime.maxVideos,
    model,
    policyVersion: VIDEO_BRIDGE_RESULT_CACHE_POLICY,
    prompt: visionRuntime.prompt,
    strategy: runtime.samplingPolicy,
  };
}

function buildVideoResultCacheKey(
  contentFingerprint: string,
  identity: VideoResultCacheIdentity,
  part: VideoPart
): string {
  return bridgeCacheKey(contentFingerprint, identity.prompt, identity.model, {
    analysisMode: identity.analysisMode,
    kind: VIDEO_BRIDGE_RESULT_CACHE_KEY_KIND,
    dedupCandidateFrameCount: identity.dedupCandidateFrameCount,
    dedupPolicyVersion: identity.dedupPolicyVersion,
    dedupThreshold: identity.dedupThreshold,
    extractorVersion: identity.extractorVersion,
    policyVersion: identity.policyVersion,
    strategy: identity.strategy,
    frameCount: identity.frameCount,
    maxVideos: identity.maxVideos,
    focusEndSeconds: part.focusWindow?.endSeconds ?? null,
    focusHintFingerprint: identity.focusHintFingerprint,
    focusStartSeconds: part.focusWindow?.startSeconds ?? null,
    transcript: safeTranscriptFingerprint(part.transcript),
    audioTranscript: safeTranscriptFingerprint(part.audioTranscript),
    contactSheet: part.contactSheet ?? false,
    version: identity.cacheVersion,
  });
}

function matchesVideoResultCacheIdentity(
  metadata: VideoResultCacheMetadata,
  identity: VideoResultCacheIdentity
): boolean {
  return VIDEO_RESULT_CACHE_IDENTITY_KEYS.every((key) => metadata[key] === identity[key]);
}

function isFusionTelemetry(value: unknown): value is VideoFusionTelemetry {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (
    typeof record.audioAvailable !== "boolean" ||
    typeof record.videoAvailable !== "boolean" ||
    typeof record.partial !== "boolean"
  ) {
    return false;
  }
  if (record.failures === undefined) return true;
  if (!record.failures || typeof record.failures !== "object") return false;
  return Object.entries(record.failures as Record<string, unknown>).every(
    ([source, code]) =>
      (source === "audio" || source === "video") &&
      (code === "ABORTED" || code === "FAILED" || code === "INVALID")
  );
}

export interface VideoBridgeDependencies {
=======
export interface VideoBridgeDependencies extends VideoSttAdapterDependencies {
>>>>>>> upstream/main
  getSettings?: () => Promise<Record<string, unknown>>;
  getCapabilities?: (model: string) => { supportsVideo: boolean | null };
  describePart?: (part: VideoPart, analysis: VideoAnalysisContext) => Promise<DescribedVideo>;
  extractFrames?: DescribeVideoDependencies["extractFrames"];
  fetchRemote?: DescribeVideoDependencies["fetchRemote"];
  resultCache?: BridgeCacheStore;
  selectVisionModel?: (fixedModel?: string) => Promise<string | null>;
  /** Base credential check the caller API-key scope narrows (GHSA-3w2r). */
  hasUsableCredentials?: (model: string) => Promise<boolean | null>;
  /** Seams for the caller API-key scope (GHSA-3w2r). */
  keyScope?: VisionBridgeKeyScopeDeps;
  callVisionModel?: (
    imageDataUri: string,
    config: VisionModelConfig,
    apiKey?: string
  ) => Promise<string>;
}

<<<<<<< HEAD
function isFiniteNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isFiniteNonNegativeInteger(value: unknown): value is number {
  return isFiniteNonNegativeNumber(value) && Number.isInteger(value);
}

function isVideoResultCacheMetadata(
  value: unknown,
  expectedCacheBytes: number
): value is VideoResultCacheMetadata {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (
    !isFiniteNonNegativeInteger(record.framesRequested) ||
    !isFiniteNonNegativeInteger(record.framesExtracted) ||
    !isFiniteNonNegativeInteger(record.framesUsed) ||
    !isFiniteNonNegativeInteger(record.dedupCandidateFrameCount) ||
    record.dedupCandidateFrameCount < 1 ||
    record.dedupCandidateFrameCount > VIDEO_DEDUP_MAX_CANDIDATE_FRAMES ||
    record.framesExtracted > record.dedupCandidateFrameCount ||
    record.framesUsed > record.framesRequested ||
    record.framesUsed > record.framesExtracted
  ) {
    return false;
  }
  const dedupDropped = record.dedupDropped ?? 0;
  if (
    !isFiniteNonNegativeInteger(dedupDropped) ||
    record.framesUsed + dedupDropped > record.framesExtracted
  ) {
    return false;
  }
  if (
    (record.focusStartSeconds !== undefined &&
      !isFiniteNonNegativeNumber(record.focusStartSeconds)) ||
    (record.focusEndSeconds !== undefined && !isFiniteNonNegativeNumber(record.focusEndSeconds)) ||
    (typeof record.focusStartSeconds === "number" &&
      typeof record.focusEndSeconds === "number" &&
      record.focusStartSeconds > record.focusEndSeconds)
  ) {
    return false;
  }
  return (
    (record.analysisMode === "full" || record.analysisMode === "focused") &&
    ((record.analysisMode === "full" && record.focusHintFingerprint === null) ||
      (record.analysisMode === "focused" &&
        typeof record.focusHintFingerprint === "string" &&
        /^[a-f0-9]{64}$/.test(record.focusHintFingerprint))) &&
    typeof record.cacheVersion === "string" &&
    typeof record.dedupPolicyVersion === "string" &&
    typeof record.dedupThreshold === "number" &&
    Number.isFinite(record.dedupThreshold) &&
    record.dedupThreshold >= 0 &&
    record.dedupThreshold <= 1 &&
    typeof record.policyVersion === "string" &&
    typeof record.extractorVersion === "string" &&
    typeof record.strategy === "string" &&
    typeof record.model === "string" &&
    typeof record.prompt === "string" &&
    isFiniteNonNegativeInteger(record.frameCount) &&
    isFiniteNonNegativeInteger(record.maxVideos) &&
    isFiniteNonNegativeNumber(record.durationSeconds) &&
    isFiniteNonNegativeInteger(record.cacheBytes) &&
    record.cacheBytes === expectedCacheBytes &&
    typeof record.modelUsed === "string" &&
    (record.samplingCandidateCount === undefined ||
      isFiniteNonNegativeInteger(record.samplingCandidateCount)) &&
    (record.samplingPolicyEffective === undefined ||
      record.samplingPolicyEffective === "uniform" ||
      record.samplingPolicyEffective === "scene_aware" ||
      record.samplingPolicyEffective === "segment_aware") &&
    (record.samplingPolicyRequested === undefined ||
      record.samplingPolicyRequested === "uniform" ||
      record.samplingPolicyRequested === "scene_aware" ||
      record.samplingPolicyRequested === "segment_aware") &&
    (record.transcriptCuesApplied === undefined ||
      isFiniteNonNegativeInteger(record.transcriptCuesApplied)) &&
    (record.contactSheetUsed === undefined || typeof record.contactSheetUsed === "boolean") &&
    (record.fusion === undefined || isFusionTelemetry(record.fusion))
  );
}

function isVideoResultCacheEntry(
  entry: BridgeCacheEntry
): entry is BridgeCacheEntry & { metadata: VideoResultCacheMetadata; value: string } {
  if (typeof entry.value !== "string") return false;
  return (
    (entry.producerModel === undefined || typeof entry.producerModel === "string") &&
    isVideoResultCacheMetadata(entry.metadata, Buffer.byteLength(entry.value, "utf8"))
  );
}

=======
/**
 * Frame vision model for a key-scoped request: picked only among the models the
 * key may use, in the key's selection-cache partition. A virtual `auto` /
 * `auto/*` model resolves to a concrete member, since the key policy is
 * checked against the model actually called.
 */
function selectScopedVideoVisionModel(
  fixedModel: string | undefined,
  keyScope: VisionBridgeKeyScope,
  hasUsableCredentials: (model: string) => Promise<boolean | null>
): Promise<string | null> {
  const concrete =
    fixedModel === "auto" || fixedModel?.startsWith("auto/") ? undefined : fixedModel;
  return getBestVisionModel(
    { fixedModel: concrete, cacheScope: keyScope.cacheScope },
    { hasUsableCredentials }
  );
}

>>>>>>> upstream/main
function resolveVideoAnalysisContext(
  body: VideoBridgeBody,
  requestedAnalysisMode: VideoAnalysisMode
): VideoAnalysisContext {
  const focusHint = requestedAnalysisMode === "focused" ? extractVideoFocusHint(body) : undefined;
  return {
    analysisMode: focusHint ? "focused" : "full",
    ...(focusHint ? { focusHint } : {}),
    focusHintFingerprint: focusHint ? createHash("sha256").update(focusHint).digest("hex") : null,
    requestedAnalysisMode,
  };
}

export class VideoBridgeGuardrail extends BaseGuardrail {
  name = "video-bridge";
  priority = 7;

  private readonly deps: VideoBridgeDependencies;

  constructor(options?: { enabled?: boolean; deps?: VideoBridgeDependencies }) {
    super("video-bridge", { priority: 7, enabled: options?.enabled });
    this.deps = options?.deps ?? {};
  }

  async preCall(payload: unknown, context: GuardrailContext): Promise<GuardrailResult<unknown>> {
    if (!this.enabled || context.disabledGuardrails?.includes("video-bridge")) {
      return { block: false };
    }

    if (context.signal?.aborted) throw new Error("Video Bridge processing was aborted");

    const body = payload as VideoBridgeBody;
    const model = context.model || body.model;
    if (!model) return { block: false };

    const getSettings = this.deps.getSettings ?? defaultGetSettings;
    let persisted: Record<string, unknown> = {};
    try {
      persisted = await getSettings();
    } catch {
      // Early boot can run before the settings database is ready; defaults are safe.
    }
    const runtime = resolveVideoBridgeRuntimeSettings(persisted);
    if (!runtime.enabled) return { block: false };

    const parts = extractVideoParts(body);
    if (parts.length === 0) return { block: false };

    const capabilities = (this.deps.getCapabilities ?? getResolvedModelCapabilities)(model);
    if (capabilities.supportsVideo === true) return { block: false };

<<<<<<< HEAD
=======
    // Raw cue fields stay sensitive even when describing the video fails or
    // maxVideos leaves it untouched. Retention must not depend on replacement.
    const rawTranscriptObserved = parts.some(
      (part) => part.transcript !== undefined || part.audioTranscript !== undefined
    );

>>>>>>> upstream/main
    const analysis = resolveVideoAnalysisContext(body, runtime.analysisMode);
    const visionRuntime = resolveVisionBridgeRuntimeSettings(persisted);
    const configuredModel = runtime.model.trim() || visionRuntime.model.trim();
    const routingPlanModel = configuredModel || "auto";
    const cache = runtime.cacheEnabled
      ? (this.deps.resultCache ?? getSharedVideoResultCacheFor(runtime))
      : null;
    const successfulModels = new Set<string>();
    // GHSA-3w2r: frames are described (and the soundtrack transcribed) on behalf
    // of the caller's API key, so every vision / STT model and connection the
    // bridge picks must be one that key could use itself.
    const keyScope = await resolveVisionBridgeKeyScope(context.apiKeyInfo, this.deps.keyScope);
    const scopedCheck = keyScope
      ? scopedCredentialCheck(this.deps.hasUsableCredentials, keyScope)
      : undefined;
    let selectedModelPromise: Promise<string | null> | null = null;
    const selectVideoModel = (): Promise<string | null> => {
      if (!selectedModelPromise) {
        const select =
          this.deps.selectVisionModel ??
          ((fixedModel?: string) =>
            keyScope && scopedCheck
              ? selectScopedVideoVisionModel(fixedModel, keyScope, scopedCheck)
              : getBestVisionModel({ fixedModel }));
        selectedModelPromise = select(configuredModel || undefined);
      }
      return selectedModelPromise;
    };
    const pipelineDeps: ProcessVideoPartDeps = {
      broker: {
        loadVideoPartBytes,
        extractFrames: this.deps.extractFrames,
        fetchRemote: this.deps.fetchRemote,
      },
      transcription: {
        describePart: createVideoSttAdapter({
          cache,
          dependencies: this.deps,
          keyScope:
            keyScope && scopedCheck ? { scope: keyScope, hasUsableCredentials: scopedCheck } : null,
          principalId: context.apiKeyInfo?.id,
          settings: persisted,
        }),
      },
      // Whole-result cache predates STT consent/model identity. Do not let a visual-only
      // entry satisfy a consented request or an STT entry satisfy an opted-out request.
      cache: resolveVideoAudioTranscriptionRuntimeSettings(persisted).enabled ? null : cache,
      selectVideoModel,
      overrideDescribePart: this.deps.describePart,
      callVisionModel: this.deps.callVisionModel,
      ...(keyScope ? { visionKeyScope: keyScope } : {}),
    };

    const startedAt = Date.now();
    const descriptions: Array<string | null> = [];
    const fallbackParts: VideoPart[] = [];
    let totalFramesRequested = 0;
    let totalFramesExtracted = 0;
    let totalFramesUsed = 0;
    let totalDurationSeconds = 0;
    let totalCacheHits = 0;
    let totalSamplingCandidateCount = 0;
    let totalDedupDropped = 0;
    let focusWindowsApplied = 0;
    let focusHintsApplied = 0;
    let transcriptCuesApplied = 0;
    let contactSheetsUsed = 0;
    let audioFusionRuns = 0;
    let audioFusionPartials = 0;
    const audioFusionFailureCodes = new Set<string>();
    const recordFusionTelemetry = (fusion?: VideoFusionTelemetry): void => {
      if (!fusion) return;
      audioFusionRuns += 1;
      if (fusion.partial) audioFusionPartials += 1;
      for (const [source, code] of Object.entries(fusion.failures ?? {})) {
        audioFusionFailureCodes.add(`${source}:${code}`);
      }
    };
    let samplingPolicyEffective: "uniform" | "scene_aware" | "segment_aware" = "uniform";
    let failures = 0;
    const logRedactionEntries: VideoBridgeLogRedactionEntry[] = [];

    const attemptedParts = parts.slice(0, runtime.maxVideos);
    for (let index = 0; index < attemptedParts.length; index++) {
      const part = attemptedParts[index];
<<<<<<< HEAD
      const attemptStartedAt = Date.now();
      const timeoutController = new AbortController();
      const attemptTimeout = setTimeout(() => timeoutController.abort(), runtime.timeoutMs);
      const attemptSignal = context.signal
        ? AbortSignal.any([context.signal, timeoutController.signal])
        : timeoutController.signal;
      try {
        const selectedModel = await waitForVideoBridgePromise(selectVideoModel(), attemptSignal);
        if (attemptSignal.aborted) throw videoBridgeAbortError();
        const shouldLoadVideoBytes =
          Boolean(selectedModel) &&
          (Boolean(cache) || (part.ref.startsWith("https://") && !this.deps.describePart));
        const videoBytes = shouldLoadVideoBytes
          ? part.ref.startsWith("https://")
            ? await runVideoDownloadSingleflight(
                buildVideoDownloadFlightKey(
                  part,
                  context,
                  VIDEO_BRIDGE_MAX_BYTES,
                  runtime.timeoutMs
                ),
                attemptSignal,
                (downloadSignal) =>
                  loadVideoPartBytes(
                    part,
                    VIDEO_BRIDGE_MAX_BYTES,
                    runtime.timeoutMs,
                    downloadSignal,
                    { fetchRemote: this.deps.fetchRemote }
                  )
              )
            : await loadVideoPartBytes(
                part,
                VIDEO_BRIDGE_MAX_BYTES,
                runtime.timeoutMs,
                attemptSignal,
                { fetchRemote: this.deps.fetchRemote }
              )
          : null;
        const contentFingerprint =
          cache && videoBytes
            ? `sha256:${createHash("sha256").update(videoBytes).digest("hex")}`
            : part.ref;
        const resultCacheIdentity =
          cache && selectedModel
            ? createVideoResultCacheIdentity(runtime, visionRuntime, selectedModel, analysis)
            : null;
        const resultCacheKey = resultCacheIdentity
          ? buildVideoResultCacheKey(contentFingerprint, resultCacheIdentity, part)
          : null;
        const cachedResult = resultCacheKey
          ? safeGetCacheEntry(cache, resultCacheKey, context.log)
          : null;
        if (cachedResult && isVideoResultCacheEntry(cachedResult)) {
          const meta = cachedResult.metadata;
          const matchPolicy =
            resultCacheIdentity && matchesVideoResultCacheIdentity(meta, resultCacheIdentity);
          if (matchPolicy) {
            const elapsed = Date.now() - attemptStartedAt;
            descriptions.push(cachedResult.value);
            totalFramesRequested += meta.framesRequested;
            totalFramesExtracted += meta.framesExtracted;
            totalFramesUsed += meta.framesUsed;
            totalDedupDropped += meta.dedupDropped ?? 0;
            if (
              typeof meta.focusStartSeconds === "number" ||
              typeof meta.focusEndSeconds === "number"
            ) {
              focusWindowsApplied += 1;
            }
            if (analysis.analysisMode === "focused") focusHintsApplied += 1;
            totalDurationSeconds += meta.durationSeconds;
            totalSamplingCandidateCount += meta.samplingCandidateCount ?? 0;
            transcriptCuesApplied += meta.transcriptCuesApplied ?? 0;
            if (meta.contactSheetUsed) contactSheetsUsed += 1;
            recordFusionTelemetry(meta.fusion);
            if (meta.samplingPolicyEffective && meta.samplingPolicyEffective !== "uniform") {
              samplingPolicyEffective = meta.samplingPolicyEffective;
            }
            if (cachedResult.producerModel) {
              successfulModels.add(cachedResult.producerModel);
            }
            if (meta.modelUsed) {
              successfulModels.add(meta.modelUsed);
            }
            recordBridgeUse("video", {
              fusionRun: Boolean(meta.fusion),
              fusionPartial: meta.fusion?.partial ?? false,
              latencyMs: elapsed,
              resultCacheHit: true,
              resultCacheBytes: meta.cacheBytes,
              resultCacheLatencyMs: elapsed,
            });
            continue;
          }
          safeDeleteCacheEntry(cache, resultCacheKey, context.log);
        } else if (cachedResult) {
          safeDeleteCacheEntry(cache, resultCacheKey, context.log);
        }
        const describeAndCache = async (processingSignal: AbortSignal) => {
          const described = this.deps.describePart
            ? await this.deps.describePart(part, analysis)
            : await this.describeWithVisionModel(
                part,
                runtime,
                visionRuntime,
                selectedModel,
                analysis,
                processingSignal,
                videoBytes ?? undefined
              );
          if (processingSignal.aborted) throw videoBridgeAbortError();
          const resultCacheBytes = Buffer.byteLength(described.description, "utf8");
          if (resultCacheKey && resultCacheIdentity) {
            safeSetCacheEntry(
              cache,
              resultCacheKey,
              {
                value: described.description,
                producerModel: described.modelUsed ?? resultCacheIdentity.model,
                metadata: {
                  ...resultCacheIdentity,
                  durationSeconds: described.durationSeconds,
                  framesRequested: described.framesRequested,
                  framesExtracted: described.framesExtracted ?? described.framesUsed,
                  framesUsed: described.framesUsed,
                  dedupDropped: described.dedupDropped ?? 0,
                  focusEndSeconds: described.focusWindow?.endSeconds,
                  focusStartSeconds: described.focusWindow?.startSeconds,
                  cacheBytes: resultCacheBytes,
                  modelUsed: described.modelUsed ?? resultCacheIdentity.model,
                  samplingCandidateCount: described.sampling?.candidateCount ?? 0,
                  samplingPolicyEffective: described.sampling?.policyEffective ?? "uniform",
                  samplingPolicyRequested:
                    described.sampling?.policyRequested ?? runtime.samplingPolicy,
                  transcriptCuesApplied: described.transcriptCues?.length ?? 0,
                  contactSheetUsed: described.contactSheetUsed ?? false,
                  ...(described.fusion ? { fusion: described.fusion } : {}),
                },
              },
              context.log
            );
          }
          return described;
        };
        const resolved =
          resultCacheKey && selectedModel
            ? await runVideoResultSingleflight(resultCacheKey, attemptSignal, describeAndCache)
            : { coalesced: false, value: await describeAndCache(attemptSignal) };
        const described = resolved.value;
        if (described.modelUsed) successfulModels.add(described.modelUsed);
        const videoCacheHits = described.cacheHits ?? 0;
        const processingLatencyMs = Date.now() - attemptStartedAt;
        descriptions.push(described.description);
        totalFramesRequested += described.framesRequested;
        totalFramesExtracted += described.framesExtracted ?? described.framesUsed;
        totalFramesUsed += described.framesUsed;
        totalDedupDropped += described.dedupDropped ?? 0;
        if (described.focusWindow) focusWindowsApplied += 1;
        if (analysis.analysisMode === "focused") focusHintsApplied += 1;
        transcriptCuesApplied += described.transcriptCues?.length ?? 0;
        if (described.contactSheetUsed) contactSheetsUsed += 1;
        recordFusionTelemetry(described.fusion);
        totalDurationSeconds += described.durationSeconds;
        totalSamplingCandidateCount += described.sampling?.candidateCount ?? 0;
        if (
          described.sampling?.policyEffective &&
          described.sampling.policyEffective !== "uniform"
        ) {
          samplingPolicyEffective = described.sampling.policyEffective;
        }
        totalCacheHits += videoCacheHits;
        if (resultCacheKey && selectedModel) {
          recordBridgeUse("video", {
            cacheHits: videoCacheHits,
            fusionRun: Boolean(described.fusion),
            fusionPartial: described.fusion?.partial ?? false,
            latencyMs: processingLatencyMs,
            resultSingleflightCoalesced: resolved.coalesced,
          });
        } else {
          recordBridgeUse("video", {
            cacheHits: videoCacheHits,
            fusionRun: Boolean(described.fusion),
            fusionPartial: described.fusion?.partial ?? false,
            latencyMs: processingLatencyMs,
          });
        }
      } catch (error) {
        if (context.signal?.aborted) throw new Error("Video Bridge processing was aborted");
=======
      const result = await processVideoPart({
        analysis,
        context,
        deps: pipelineDeps,
        part,
        partIndex: index,
        runtime,
        visionRuntime,
      });

      if (result.status === "aborted") {
        throw new Error("Video Bridge processing was aborted");
      }
      if (result.status === "failed") {
>>>>>>> upstream/main
        failures += 1;
        fallbackParts.push(part);
        descriptions.push(
          capabilities.supportsVideo === false
            ? `[Video ${index + 1}]: (unavailable — video could not be described)`
            : null
        );
<<<<<<< HEAD
      } finally {
        clearTimeout(attemptTimeout);
=======
        continue;
>>>>>>> upstream/main
      }

      descriptions.push(result.description);
      if (result.descriptionRedacted !== undefined) {
        logRedactionEntries.push({
          container: part.container,
          messageIndex: part.messageIndex,
          partIndex: part.partIndex,
          // The exact text `replaceVideoParts` is about to write into
          // content[partIndex].text (same `result.description` value pushed
          // to `descriptions` just above) — the content-address key the
          // downstream consumer matches on. See the interface doc.
          fullText: result.description,
          redactedText: result.descriptionRedacted,
        });
      }
      totalFramesRequested += result.framesRequested;
      totalFramesExtracted += result.framesExtracted;
      totalFramesUsed += result.framesUsed;
      totalDedupDropped += result.dedupDropped;
      if (result.hasFocusWindow) focusWindowsApplied += 1;
      if (analysis.analysisMode === "focused") focusHintsApplied += 1;
      totalDurationSeconds += result.durationSeconds;
      totalSamplingCandidateCount += result.samplingCandidateCount;
      transcriptCuesApplied += result.transcriptCuesApplied;
      if (result.contactSheetUsed) contactSheetsUsed += 1;
      recordFusionTelemetry(result.fusion);
      if (result.samplingPolicyEffective !== "uniform") {
        samplingPolicyEffective = result.samplingPolicyEffective;
      }
      for (const producerModel of result.producerModels) successfulModels.add(producerModel);
      totalCacheHits += result.frameCacheHits;
    }

    for (let index = attemptedParts.length; index < parts.length; index++) {
      fallbackParts.push(parts[index]);
      descriptions.push(
        capabilities.supportsVideo === false
          ? `[Video ${index + 1}]: (not processed because the per-request video limit was reached)`
          : null
      );
    }

    const videosProcessed = attemptedParts.length - failures;
    const videosReplaced = descriptions.filter((description) => description !== null).length;
    if (videosReplaced === 0 && !rawTranscriptObserved) return { block: false };

    const modifiedPayload = replaceVideoParts(body, parts, descriptions);
    logRedactionEntries.push(
      ...appendVideoFallbackTranscripts(modifiedPayload, fallbackParts, context.log)
    );

    return {
      block: false,
      modifiedPayload,
      meta: {
        analysisMode: analysis.analysisMode,
        analysisModeRequested: analysis.requestedAnalysisMode,
        cacheHits: totalCacheHits,
        durationSeconds: totalDurationSeconds,
        failures,
        framesExtracted: totalFramesExtracted,
        framesRequested: totalFramesRequested,
        framesUsed: totalFramesUsed,
        dedupDropped: totalDedupDropped,
        focusWindowsApplied,
        focusHintsApplied,
        transcriptCuesApplied,
        // Protect both rendered cues and raw fields on unreplaced video parts.
        // Frames without transcript fields retain their normal logging policy.
        videoBridgeObserved: rawTranscriptObserved || logRedactionEntries.length > 0,
        ...(logRedactionEntries.length > 0 ? { videoBridgeLogRedaction: logRedactionEntries } : {}),
        contactSheetsUsed,
        audioFusionRuns,
        audioFusionPartials,
        audioFusionFailureCodes: [...audioFusionFailureCodes].sort(),
        samplingCandidateCount: totalSamplingCandidateCount,
        samplingPolicyEffective,
        samplingPolicyRequested: runtime.samplingPolicy,
        processingTimeMs: Date.now() - startedAt,
        attempts: attemptedParts.length,
        videoModel: combineModelIdentities(successfulModels, routingPlanModel),
        videosProcessed,
        videosReplaced,
      },
    };
  }
<<<<<<< HEAD

  private async describeWithVisionModel(
    part: VideoPart,
    runtime: ReturnType<typeof resolveVideoBridgeRuntimeSettings>,
    visionRuntime: ReturnType<typeof resolveVisionBridgeRuntimeSettings>,
    selectedModel: string | null,
    analysis: VideoAnalysisContext,
    signal?: AbortSignal,
    preloadedBytes?: Uint8Array
  ): Promise<DescribedVideo> {
    if (!selectedModel) {
      throw new Error("No vision-capable provider connected for Video Bridge");
    }
    const cache = runtime.cacheEnabled ? getSharedBridgeCacheFor(runtime) : null;
    const callVisionModel = this.deps.callVisionModel ?? defaultCallVisionModel;
    let cacheHits = 0;
    const successfulModels = new Set<string>();
    const described = await defaultDescribeVideoPart(
      part,
      {
        analysisMode: analysis.analysisMode,
        frameCount: runtime.frameCount,
        samplingPolicy: runtime.samplingPolicy,
        focusWindow: part.focusWindow,
        signal,
        timeoutMs: runtime.timeoutMs,
      },
      async (frameDataUri, timestampSeconds, signal) => {
        const prompt = composeVideoFramePrompt(
          visionRuntime.prompt,
          timestampSeconds,
          analysis.focusHint
        );
        const key = cache
          ? bridgeCacheKey(frameDataUri, `${prompt}@${timestampSeconds.toFixed(3)}`, selectedModel)
          : null;
        const cached = key && cache ? cache.getEntry(key) : undefined;
        if (cached) {
          cacheHits += 1;
          successfulModels.add(cached.producerModel ?? selectedModel);
          return cached.value;
        }
        let producerModel = selectedModel;
        const caption = await callVisionModel(frameDataUri, {
          maxImages: 1,
          model: selectedModel,
          onModelUsed: (model) => {
            producerModel = model;
          },
          prompt,
          routeThroughOmniRoute: true,
          signal,
          timeoutMs: runtime.timeoutMs,
          fetchImpl: undiciFetch as unknown as typeof fetch,
        });
        successfulModels.add(producerModel);
        if (key && cache) cache.setEntry(key, { value: caption, producerModel });
        return caption;
      },
      {
        extractFrames: this.deps.extractFrames,
        fetchRemote: this.deps.fetchRemote,
      },
      preloadedBytes
    );
    return {
      ...described,
      cacheHits,
      modelUsed: combineModelIdentities(successfulModels, selectedModel),
    };
  }
=======
>>>>>>> upstream/main
}
