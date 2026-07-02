import { describe, expect, it } from "vitest";
import { mergeResume, normalizeExtracted } from "./importResume";
import type { ExtractedResume } from "./llm";
import { createEmptyResume, type ResumeData } from "../types/resume";

function sampleExtracted(): ExtractedResume {
  return {
    profile: {
      name: "山田 太郎",
      nameKana: "やまだ たろう",
      birthMonth: "1990-04",
      location: "東京都",
      education: "〇〇大学卒",
      summary: "バックエンド中心に10年の経験",
    },
    skills: [
      { name: "TypeScript", category: "言語", years: 5, level: "上級", note: "" },
      { name: "React", category: "フレームワーク", years: 4, level: "中級", note: "" },
    ],
    projects: [
      {
        name: "ECサイト開発",
        startMonth: "2024-01",
        endMonth: "",
        role: "バックエンド",
        teamSize: "5名",
        description: "API開発",
        technologies: ["TypeScript", "PostgreSQL"],
        phases: ["実装", "テスト"],
        achievements: "性能改善",
      },
    ],
  };
}

describe("normalizeExtracted", () => {
  it("正常な抽出結果に id を付与して変換する", () => {
    const patch = normalizeExtracted(sampleExtracted());
    expect(patch.profile.name).toBe("山田 太郎");
    expect(patch.skills).toHaveLength(2);
    expect(patch.skills[0].id).toBeTruthy();
    expect(patch.projects[0].phases).toEqual(["実装", "テスト"]);
  });

  it("不正なカテゴリ・レベル・工程を許容値に丸める", () => {
    const extracted = sampleExtracted();
    extracted.skills[0].category = "謎カテゴリ";
    extracted.skills[0].level = "神";
    extracted.projects[0].phases = ["実装", "存在しない工程"];
    const patch = normalizeExtracted(extracted);
    expect(patch.skills[0].category).toBe("その他");
    expect(patch.skills[0].level).toBe("中級");
    expect(patch.projects[0].phases).toEqual(["実装"]);
  });

  it("名前が空のスキルと負の経験年数を除去・補正する", () => {
    const extracted = sampleExtracted();
    extracted.skills.push({ name: "  ", category: "言語", years: 1, level: "初級", note: "" });
    extracted.skills[0].years = -3;
    const patch = normalizeExtracted(extracted);
    expect(patch.skills).toHaveLength(2);
    expect(patch.skills[0].years).toBe(0);
  });

  it("欠損フィールドを空値で補完する", () => {
    const patch = normalizeExtracted({} as ExtractedResume);
    expect(patch.profile.name).toBe("");
    expect(patch.skills).toEqual([]);
    expect(patch.projects).toEqual([]);
  });
});

describe("mergeResume", () => {
  function currentData(): ResumeData {
    const data = createEmptyResume();
    data.profile.name = "既存 花子";
    data.skills = [
      {
        id: "existing-1",
        name: "typescript",
        category: "言語",
        years: 3,
        level: "中級",
        note: "",
      },
    ];
    data.projects = [
      {
        id: "existing-p1",
        name: "既存案件",
        startMonth: "2020-01",
        endMonth: "2021-01",
        role: "SE",
        teamSize: "3名",
        description: "",
        technologies: [],
        phases: [],
        achievements: "",
      },
    ];
    return data;
  }

  it("append: プロフィールは空欄のみ補完する", () => {
    const merged = mergeResume(currentData(), normalizeExtracted(sampleExtracted()), "append");
    expect(merged.profile.name).toBe("既存 花子"); // 既存値を保持
    expect(merged.profile.nameKana).toBe("やまだ たろう"); // 空欄は補完
  });

  it("append: 同名スキル (大文字小文字無視) は追加しない", () => {
    const merged = mergeResume(currentData(), normalizeExtracted(sampleExtracted()), "append");
    const names = merged.skills.map((s) => s.name.toLowerCase());
    expect(names.filter((n) => n === "typescript")).toHaveLength(1);
    expect(names).toContain("react");
  });

  it("append: 経歴は先頭に追加し既存を保持する", () => {
    const merged = mergeResume(currentData(), normalizeExtracted(sampleExtracted()), "append");
    expect(merged.projects).toHaveLength(2);
    expect(merged.projects[0].name).toBe("ECサイト開発");
    expect(merged.projects[1].id).toBe("existing-p1");
  });

  it("replace: 抽出結果で置き換える", () => {
    const merged = mergeResume(currentData(), normalizeExtracted(sampleExtracted()), "replace");
    expect(merged.profile.name).toBe("山田 太郎");
    expect(merged.skills).toHaveLength(2);
    expect(merged.projects).toHaveLength(1);
  });

  it("version と updatedAt は維持する (保存時に更新される)", () => {
    const current = currentData();
    const merged = mergeResume(current, normalizeExtracted(sampleExtracted()), "replace");
    expect(merged.version).toBe(1);
    expect(merged.updatedAt).toBe(current.updatedAt);
  });
});
