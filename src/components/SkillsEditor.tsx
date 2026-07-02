import {
  SKILL_CATEGORIES,
  SKILL_LEVELS,
  createEmptySkill,
  type Skill,
} from "../types/resume";
import { Field, SelectField, TextField } from "./fields";

function SkillRow({
  skill,
  onChange,
  onRemove,
}: {
  skill: Skill;
  onChange: (skill: Skill) => void;
  onRemove: () => void;
}) {
  const update = <K extends keyof Skill>(key: K, value: Skill[K]) =>
    onChange({ ...skill, [key]: value });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem_6rem_7rem_1fr_auto]">
        <TextField
          label="スキル名"
          value={skill.name}
          onChange={(v) => update("name", v)}
          placeholder="TypeScript"
        />
        <SelectField
          label="カテゴリ"
          value={skill.category}
          options={SKILL_CATEGORIES}
          onChange={(v) => update("category", v)}
        />
        <Field label="経験年数">
          <input
            type="number"
            min={0}
            step={0.5}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:focus:ring-slate-700"
            value={skill.years}
            onChange={(e) => update("years", Number(e.currentTarget.value))}
          />
        </Field>
        <SelectField
          label="レベル"
          value={skill.level}
          options={SKILL_LEVELS}
          onChange={(v) => update("level", v)}
        />
        <TextField
          label="補足"
          value={skill.note}
          onChange={(v) => update("note", v)}
          placeholder="個人開発のみ 等"
        />
        <div className="flex items-end">
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg px-3 py-2 text-sm text-red-500 transition hover:bg-red-50 dark:hover:bg-red-950"
          >
            削除
          </button>
        </div>
      </div>
    </div>
  );
}

export function SkillsEditor({
  skills,
  onChange,
}: {
  skills: Skill[];
  onChange: (skills: Skill[]) => void;
}) {
  return (
    <div className="space-y-3">
      {skills.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400 dark:border-slate-700">
          スキルが未登録です。「スキルを追加」から登録してください。
        </p>
      )}
      {skills.map((skill) => (
        <SkillRow
          key={skill.id}
          skill={skill}
          onChange={(updated) =>
            onChange(skills.map((s) => (s.id === updated.id ? updated : s)))
          }
          onRemove={() => onChange(skills.filter((s) => s.id !== skill.id))}
        />
      ))}
      <button
        type="button"
        onClick={() => onChange([...skills, createEmptySkill()])}
        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        + スキルを追加
      </button>
    </div>
  );
}
