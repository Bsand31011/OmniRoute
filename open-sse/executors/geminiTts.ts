import { Buffer } from "node:buffer";
<<<<<<< HEAD
import { extractInlineAudio, parsePcmSampleRate, pcmToWav } from "./vertexMedia.ts";
=======
import { buildGeminiSpeechStyle, extractInlineAudio, normalizeAudioOutput } from "./vertexMedia.ts";
>>>>>>> upstream/main
import { CORS_HEADERS } from "../utils/cors.ts";
import { upstreamErrorResponse } from "../utils/audioResponse.ts";
import { errorResponse } from "../utils/error.ts";

type GeminiTtsCredentials = {
  apiKey?: string | null;
  accessToken?: string | null;
};

export class GeminiTtsUpstreamError extends Error {
  constructor(
    public readonly response: Response,
    public readonly body: string
  ) {
    super(`Gemini TTS upstream error (${response.status})`);
  }
}

export async function geminiGenerateSpeech(
  credentials: GeminiTtsCredentials,
<<<<<<< HEAD
  options: { model: string; text: string; voice: string }
): Promise<Buffer> {
=======
  options: {
    model: string;
    text: string;
    voice: string;
    instructions?: string;
    speed?: number;
    response_format?: string;
  }
): Promise<{ audio: Buffer; contentType: string }> {
>>>>>>> upstream/main
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (credentials.apiKey) {
    headers["x-goog-api-key"] = credentials.apiKey;
  } else if (credentials.accessToken) {
    headers.Authorization = `Bearer ${credentials.accessToken}`;
  }

<<<<<<< HEAD
=======
  const style = buildGeminiSpeechStyle(options.instructions, options.speed);

>>>>>>> upstream/main
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(options.model)}:generateContent`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
<<<<<<< HEAD
        contents: [{ parts: [{ text: options.text }] }],
=======
        contents: [
          {
            parts: [
              {
                text: options.text,
                ...(style ? { speech_metadata: { style } } : {}),
              },
            ],
          },
        ],
>>>>>>> upstream/main
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: options.voice },
            },
          },
        },
      }),
    }
  );
  if (!response.ok) {
    throw new GeminiTtsUpstreamError(response, await response.text());
  }

  const inline = extractInlineAudio(await response.json());
  if (!inline) throw new Error("Gemini TTS response did not contain audio data");
<<<<<<< HEAD
  return pcmToWav(Buffer.from(inline.base64, "base64"), parsePcmSampleRate(inline.mimeType));
=======
  const rawBuffer = Buffer.from(inline.base64, "base64");
  return normalizeAudioOutput(rawBuffer, inline.mimeType, options.response_format);
>>>>>>> upstream/main
}

export async function handleGeminiTtsSpeech(
  credentials: GeminiTtsCredentials,
<<<<<<< HEAD
  options: { model: string; text: string; voice?: unknown }
): Promise<Response> {
  try {
    const wav = await geminiGenerateSpeech(credentials, {
      model: options.model,
      text: options.text,
      voice:
        typeof options.voice === "string" && options.voice.trim() ? options.voice.trim() : "Kore",
    });
    return new Response(new Uint8Array(wav), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "audio/wav" },
=======
  options: {
    model: string;
    text: string;
    voice?: unknown;
    instructions?: unknown;
    speed?: unknown;
    response_format?: unknown;
  }
): Promise<Response> {
  try {
    const voice =
      typeof options.voice === "string" && options.voice.trim() ? options.voice.trim() : "Kore";
    const instructions =
      typeof options.instructions === "string" && options.instructions.trim()
        ? options.instructions.trim()
        : undefined;
    const speed = typeof options.speed === "number" ? options.speed : undefined;
    const response_format =
      typeof options.response_format === "string" && options.response_format.trim()
        ? options.response_format.trim()
        : undefined;

    const { audio, contentType } = await geminiGenerateSpeech(credentials, {
      model: options.model,
      text: options.text,
      voice,
      instructions,
      speed,
      response_format,
    });
    return new Response(new Uint8Array(audio), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": contentType },
>>>>>>> upstream/main
    });
  } catch (error) {
    if (error instanceof GeminiTtsUpstreamError) {
      return upstreamErrorResponse(error.response, error.body);
    }
    const message = error instanceof Error ? error.message : String(error);
    return errorResponse(500, `Speech request failed: ${message}`);
  }
}
