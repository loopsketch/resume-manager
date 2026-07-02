/** 業務履歴書データのスキーマ定義 */

export interface Profile {
  /** 氏名 */
  name: string;
  /** ふりがな */
  nameKana: string;
  /** 生年月 (YYYY-MM) */
  birthMonth: string;
  /** 最寄り駅・所在地など */
  location: string;
  /** 学歴・最終学歴 */
  education: string;
  /** 自己PR・概要 */
  summary: string;
}

export const SKILL_CATEGORIES = [
  "言語",
  "フレームワーク",
  "データベース",
  "インフラ・クラウド",
  "ツール",
  "その他",
] as const;

export type SkillCategory = (typeof SKILL_CATEGORIES)[number];

export const SKILL_LEVELS = ["初級", "中級", "上級"] as const;

export type SkillLevel = (typeof SKILL_LEVELS)[number];

export interface Skill {
  id: string;
  /** スキル名 (例: TypeScript) */
  name: string;
  category: SkillCategory;
  /** 経験年数 */
  years: number;
  level: SkillLevel;
  /** 補足 (例: 個人開発のみ) */
  note: string;
}

export const PROJECT_PHASES = [
  "要件定義",
  "基本設計",
  "詳細設計",
  "実装",
  "テスト",
  "運用・保守",
] as const;

export type ProjectPhase = (typeof PROJECT_PHASES)[number];

export interface Project {
  id: string;
  /** 案件名・プロジェクト名 */
  name: string;
  /** 開始年月 (YYYY-MM) */
  startMonth: string;
  /** 終了年月 (YYYY-MM)。継続中は空文字 */
  endMonth: string;
  /** 役割 (例: バックエンドエンジニア, PL) */
  role: string;
  /** チーム規模 (例: 5名) */
  teamSize: string;
  /** 業務内容 */
  description: string;
  /** 使用技術 */
  technologies: string[];
  /** 担当工程 */
  phases: ProjectPhase[];
  /** 実績・工夫した点 */
  achievements: string;
}

export interface ResumeData {
  /** スキーマバージョン */
  version: 1;
  profile: Profile;
  skills: Skill[];
  projects: Project[];
  /** 最終更新日時 (ISO 8601) */
  updatedAt: string;
}

export function createEmptyProfile(): Profile {
  return {
    name: "",
    nameKana: "",
    birthMonth: "",
    location: "",
    education: "",
    summary: "",
  };
}

export function createEmptySkill(): Skill {
  return {
    id: crypto.randomUUID(),
    name: "",
    category: "言語",
    years: 1,
    level: "中級",
    note: "",
  };
}

export function createEmptyProject(): Project {
  return {
    id: crypto.randomUUID(),
    name: "",
    startMonth: "",
    endMonth: "",
    role: "",
    teamSize: "",
    description: "",
    technologies: [],
    phases: [],
    achievements: "",
  };
}

export function createEmptyResume(): ResumeData {
  return {
    version: 1,
    profile: createEmptyProfile(),
    skills: [],
    projects: [],
    updatedAt: new Date().toISOString(),
  };
}
