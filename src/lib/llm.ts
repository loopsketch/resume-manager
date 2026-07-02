import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface LlmStatus {
  binaryInstalled: boolean;
  modelInstalled: boolean;
  running: boolean;
  ready: boolean;
}

export interface DownloadProgress {
  /** "binary" = llama-server, "model" = GGUF モデル */
  stage: "binary" | "model";
  downloaded: number;
  total: number | null;
  done: boolean;
}

/** LLM が出力する抽出結果（id / version なしの生データ） */
export interface ExtractedResume {
  profile: {
    name: string;
    nameKana: string;
    birthMonth: string;
    location: string;
    education: string;
    summary: string;
  };
  skills: {
    name: string;
    category: string;
    years: number;
    level: string;
    note: string;
  }[];
  projects: {
    name: string;
    startMonth: string;
    endMonth: string;
    role: string;
    teamSize: string;
    description: string;
    technologies: string[];
    phases: string[];
    achievements: string;
  }[];
}

export const getLlmStatus = () => invoke<LlmStatus>("llm_status");
export const setupLlm = () => invoke<void>("setup_llm");
export const startLlm = () => invoke<void>("start_llm");
export const stopLlm = () => invoke<void>("stop_llm");

export const extractResume = (text: string) =>
  invoke<ExtractedResume>("extract_resume", { text });

export const onDownloadProgress = (
  callback: (progress: DownloadProgress) => void,
): Promise<UnlistenFn> =>
  listen<DownloadProgress>("llm-download-progress", (event) => callback(event.payload));
