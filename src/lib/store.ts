import { invoke } from "@tauri-apps/api/core";
import type { ResumeData } from "../types/resume";

/** 保存済みデータを読み込む。未保存なら null。 */
export async function loadResume(): Promise<ResumeData | null> {
  return await invoke<ResumeData | null>("load_resume");
}

/** データを保存する。updatedAt を更新した保存済みデータを返す。 */
export async function saveResume(data: ResumeData): Promise<ResumeData> {
  const toSave: ResumeData = { ...data, updatedAt: new Date().toISOString() };
  await invoke("save_resume", { data: toSave });
  return toSave;
}
