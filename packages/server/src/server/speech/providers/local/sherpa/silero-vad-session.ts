import { EventEmitter } from "node:events";
import { fileURLToPath } from "node:url";

import { pcm16leToFloat32 } from "../../../audio.js";
import type { TurnDetectionSession } from "../../../turn-detection-provider.js";
import { loadSherpaOnnxNode } from "./sherpa-onnx-node-loader.js";

const DEFAULT_SAMPLE_RATE = 16000;
const DEFAULT_BUFFER_SIZE_SECONDS = 60;
const DEFAULT_SILERO_THRESHOLD = 0.5;
const DEFAULT_MIN_SILENCE_DURATION = 1.2;
const DEFAULT_MIN_SPEECH_DURATION = 0.2;
const DEFAULT_WINDOW_SIZE = 512;

type SherpaVadHandle = {
  acceptWaveform(samples: Float32Array): void;
  isDetected(): boolean;
  isEmpty(): boolean;
  flush(): void;
  reset(): void;
};

type SherpaCircularBufferHandle = {
  push(samples: Float32Array): void;
  get(startIndex: number, n: number, enableExternalBuffer?: boolean): Float32Array;
  pop(n: number): void;
  size(): number;
  head(): number;
  reset(): void;
};

type SherpaVadModule = {
  Vad: new (config: Record<string, unknown>, bufferSizeInSeconds: number) => SherpaVadHandle;
  CircularBuffer: new (capacity: number) => SherpaCircularBufferHandle;
};

export function resolveBundledSileroVadModelPath(): string {
  return fileURLToPath(new URL("./assets/silero_vad.onnx", import.meta.url));
}

export interface SherpaSileroVadSessionConfig {
  modelPath?: string;
  sampleRate?: number;
  threshold?: number;
  minSilenceDuration?: number;
  minSpeechDuration?: number;
  windowSize?: number;
  bufferSizeInSeconds?: number;
}

export class SherpaSileroVadSession extends EventEmitter implements TurnDetectionSession {
  public readonly requiredSampleRate: number;

  private readonly vad: SherpaVadHandle;
  private readonly inputBuffer: SherpaCircularBufferHandle;
  private readonly windowSize: number;
  private connected = false;
  private inSpeech = false;
  private readonly logger;

  constructor(params: {
    logger: { debug: (...args: unknown[]) => void };
    config?: SherpaSileroVadSessionConfig;
  }) {
    super();
    this.logger = params.logger;
    const config = params.config ?? {};
    this.requiredSampleRate = config.sampleRate ?? DEFAULT_SAMPLE_RATE;
    this.windowSize = config.windowSize ?? DEFAULT_WINDOW_SIZE;

    const sherpa = loadSherpaOnnxNode() as unknown as SherpaVadModule;
    this.vad = new sherpa.Vad(
      {
        sileroVad: {
          model: config.modelPath ?? resolveBundledSileroVadModelPath(),
          threshold: config.threshold ?? DEFAULT_SILERO_THRESHOLD,
          minSilenceDuration: config.minSilenceDuration ?? DEFAULT_MIN_SILENCE_DURATION,
          minSpeechDuration: config.minSpeechDuration ?? DEFAULT_MIN_SPEECH_DURATION,
          windowSize: config.windowSize ?? DEFAULT_WINDOW_SIZE,
        },
        sampleRate: this.requiredSampleRate,
        numThreads: 1,
        provider: "cpu",
        debug: 0,
      },
      config.bufferSizeInSeconds ?? DEFAULT_BUFFER_SIZE_SECONDS,
    );
    this.inputBuffer = new sherpa.CircularBuffer(
      (config.bufferSizeInSeconds ?? DEFAULT_BUFFER_SIZE_SECONDS) * this.requiredSampleRate,
    );
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  appendPcm16(pcm16le: Buffer): void {
    if (!this.connected) {
      this.emit("error", new Error("Turn detection session not connected"));
      return;
    }
    if (pcm16le.length === 0) {
      return;
    }

    try {
      const samples = pcm16leToFloat32(pcm16le, 1);
      this.inputBuffer.push(samples);
      while (this.inputBuffer.size() > this.windowSize) {
        const window = this.inputBuffer.get(this.inputBuffer.head(), this.windowSize, false);
        this.inputBuffer.pop(this.windowSize);
        this.vad.acceptWaveform(window);
        this.syncDetectionState();
      }
    } catch (error) {
      this.emit("error", error instanceof Error ? error : new Error(String(error)));
    }
  }

  flush(): void {
    if (!this.connected) {
      return;
    }

    try {
      this.vad.flush();
      this.syncDetectionState();
      if (this.inSpeech) {
        this.inSpeech = false;
        this.emit("speech_stopped");
      }
    } catch (error) {
      this.emit("error", error instanceof Error ? error : new Error(String(error)));
    }
  }

  close(): void {
    try {
      this.vad.reset();
      this.inputBuffer.reset();
    } catch {
      // ignore native cleanup failures
    } finally {
      this.connected = false;
      this.inSpeech = false;
    }
  }

  private syncDetectionState(): void {
    const detected = this.vad.isDetected();
    if (detected && !this.inSpeech) {
      this.inSpeech = true;
      this.emit("speech_started");
      return;
    }

    if (!detected && this.inSpeech && !this.vad.isEmpty()) {
      this.logger.debug("Silero VAD marked end of speech");
      this.inSpeech = false;
      this.emit("speech_stopped");
    }
  }
}
