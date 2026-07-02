import type { ExtractedResume } from "./llm";
import {
  PROJECT_PHASES,
  SKILL_CATEGORIES,
  SKILL_LEVELS,
  type Profile,
  type Project,
  type ProjectPhase,
  type ResumeData,
  type Skill,
  type SkillCategory,
  type SkillLevel,
} from "../types/resume";

/** LLM の抽出結果を検証し、アプリのデータ型（id 付与済み）へ正規化する */
export interface ResumePatch {
  profile: Profile;
  skills: Skill[];
  projects: Project[];
}

function asCategory(value: string): SkillCategory {
  return (SKILL_CATEGORIES as readonly string[]).includes(value)
    ? (value as SkillCategory)
    : "その他";
}

function asLevel(value: string): SkillLevel {
  return (SKILL_LEVELS as readonly string[]).includes(value)
    ? (value as SkillLevel)
    : "中級";
}

function asPhases(values: string[]): ProjectPhase[] {
  return PROJECT_PHASES.filter((p) => values.includes(p));
}

export function normalizeExtracted(extracted: ExtractedResume): ResumePatch {
  return {
    profile: {
      name: extracted.profile?.name ?? "",
      nameKana: extracted.profile?.nameKana ?? "",
      birthMonth: extracted.profile?.birthMonth ?? "",
      location: extracted.profile?.location ?? "",
      education: extracted.profile?.education ?? "",
      summary: extracted.profile?.summary ?? "",
    },
    skills: (extracted.skills ?? [])
      .filter((s) => s.name?.trim())
      .map((s) => ({
        id: crypto.randomUUID(),
        name: s.name.trim(),
        category: asCategory(s.category),
        years: Number.isFinite(s.years) && s.years >= 0 ? s.years : 0,
        level: asLevel(s.level),
        note: s.note ?? "",
      })),
    projects: (extracted.projects ?? [])
      .filter((p) => p.name?.trim() || p.description?.trim())
      .map((p) => ({
        id: crypto.randomUUID(),
        name: p.name ?? "",
        startMonth: p.startMonth ?? "",
        endMonth: p.endMonth ?? "",
        role: p.role ?? "",
        teamSize: p.teamSize ?? "",
        description: p.description ?? "",
        technologies: (p.technologies ?? []).map((t) => t.trim()).filter(Boolean),
        phases: asPhases(p.phases ?? []),
        achievements: p.achievements ?? "",
      })),
  };
}

export type ImportMode = "append" | "replace";

/**
 * 取り込みモードに応じて既存データへ反映する。
 * - append: プロフィールは空欄のみ補完、スキルは同名を除いて追加、経歴は追加
 * - replace: 抽出結果でまるごと置き換え
 */
export function mergeResume(
  current: ResumeData,
  patch: ResumePatch,
  mode: ImportMode,
): ResumeData {
  if (mode === "replace") {
    return {
      ...current,
      profile: patch.profile,
      skills: patch.skills,
      projects: patch.projects,
    };
  }

  const profile: Profile = { ...current.profile };
  for (const key of Object.keys(profile) as (keyof Profile)[]) {
    if (!profile[key] && patch.profile[key]) {
      profile[key] = patch.profile[key];
    }
  }

  const existingSkillNames = new Set(
    current.skills.map((s) => s.name.toLowerCase()),
  );
  const newSkills = patch.skills.filter(
    (s) => !existingSkillNames.has(s.name.toLowerCase()),
  );

  return {
    ...current,
    profile,
    skills: [...current.skills, ...newSkills],
    projects: [...patch.projects, ...current.projects],
  };
}
