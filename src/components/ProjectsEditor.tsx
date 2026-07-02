import {
  PROJECT_PHASES,
  createEmptyProject,
  type Project,
  type ProjectPhase,
} from "../types/resume";
import { Field, TextArea, TextField } from "./fields";

function PhaseToggles({
  phases,
  onChange,
}: {
  phases: ProjectPhase[];
  onChange: (phases: ProjectPhase[]) => void;
}) {
  const toggle = (phase: ProjectPhase) =>
    onChange(
      phases.includes(phase)
        ? phases.filter((p) => p !== phase)
        : [...PROJECT_PHASES.filter((p) => phases.includes(p) || p === phase)],
    );

  return (
    <div className="flex flex-wrap gap-2">
      {PROJECT_PHASES.map((phase) => {
        const active = phases.includes(phase);
        return (
          <button
            key={phase}
            type="button"
            onClick={() => toggle(phase)}
            className={
              active
                ? "rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white dark:bg-slate-100 dark:text-slate-900"
                : "rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            }
          >
            {phase}
          </button>
        );
      })}
    </div>
  );
}

function ProjectCard({
  project,
  onChange,
  onRemove,
}: {
  project: Project;
  onChange: (project: Project) => void;
  onRemove: () => void;
}) {
  const update = <K extends keyof Project>(key: K, value: Project[K]) =>
    onChange({ ...project, [key]: value });

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <TextField
            label="案件名"
            value={project.name}
            onChange={(v) => update("name", v)}
            placeholder="ECサイト リニューアル開発"
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="mt-5 rounded-lg px-3 py-2 text-sm text-red-500 transition hover:bg-red-50 dark:hover:bg-red-950"
        >
          削除
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <TextField
          label="開始年月"
          type="month"
          value={project.startMonth}
          onChange={(v) => update("startMonth", v)}
        />
        <TextField
          label="終了年月（継続中は空欄）"
          type="month"
          value={project.endMonth}
          onChange={(v) => update("endMonth", v)}
        />
        <TextField
          label="役割"
          value={project.role}
          onChange={(v) => update("role", v)}
          placeholder="バックエンドエンジニア"
        />
        <TextField
          label="チーム規模"
          value={project.teamSize}
          onChange={(v) => update("teamSize", v)}
          placeholder="5名"
        />
      </div>

      <TextArea
        label="業務内容"
        value={project.description}
        onChange={(v) => update("description", v)}
        rows={3}
      />

      <TextField
        label="使用技術（カンマ区切り）"
        value={project.technologies.join(", ")}
        onChange={(v) =>
          update(
            "technologies",
            v
              .split(/[,、]/)
              .map((t) => t.trim())
              .filter(Boolean),
          )
        }
        placeholder="TypeScript, React, PostgreSQL"
      />

      <Field label="担当工程">
        <PhaseToggles
          phases={project.phases}
          onChange={(phases) => update("phases", phases)}
        />
      </Field>

      <TextArea
        label="実績・工夫した点"
        value={project.achievements}
        onChange={(v) => update("achievements", v)}
        rows={3}
      />
    </div>
  );
}

export function ProjectsEditor({
  projects,
  onChange,
}: {
  projects: Project[];
  onChange: (projects: Project[]) => void;
}) {
  return (
    <div className="space-y-4">
      {projects.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400 dark:border-slate-700">
          職務経歴が未登録です。「経歴を追加」から登録してください。
        </p>
      )}
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          onChange={(updated) =>
            onChange(projects.map((p) => (p.id === updated.id ? updated : p)))
          }
          onRemove={() => onChange(projects.filter((p) => p.id !== project.id))}
        />
      ))}
      <button
        type="button"
        onClick={() => onChange([createEmptyProject(), ...projects])}
        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        + 経歴を追加
      </button>
    </div>
  );
}
