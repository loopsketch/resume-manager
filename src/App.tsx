import { useEffect, useState } from "react";
import { ImportPanel } from "./components/ImportPanel";
import { ProfileForm } from "./components/ProfileForm";
import { ProjectsEditor } from "./components/ProjectsEditor";
import { SkillsEditor } from "./components/SkillsEditor";
import { mergeResume, type ImportMode, type ResumePatch } from "./lib/importResume";
import { loadResume, saveResume } from "./lib/store";
import { createEmptyResume, type ResumeData } from "./types/resume";

const TABS = [
  { id: "profile", label: "プロフィール" },
  { id: "skills", label: "スキル" },
  { id: "projects", label: "職務経歴" },
  { id: "import", label: "インポート" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("ja-JP", { dateStyle: "medium", timeStyle: "short" });
}

function App() {
  const [resume, setResume] = useState<ResumeData | null>(null);
  const [tab, setTab] = useState<TabId>("profile");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadResume()
      .then((data) => setResume(data ?? createEmptyResume()))
      .catch((e) => {
        setError(String(e));
        setResume(createEmptyResume());
      });
  }, []);

  const update = (partial: Partial<ResumeData>) => {
    setResume((prev) => (prev ? { ...prev, ...partial } : prev));
    setDirty(true);
  };

  const handleImport = (patch: ResumePatch, mode: ImportMode) => {
    setResume((prev) => (prev ? mergeResume(prev, patch, mode) : prev));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!resume || saving) return;
    setSaving(true);
    setError("");
    try {
      const saved = await saveResume(resume);
      setResume(saved);
      setDirty(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  if (!resume) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-400 dark:bg-slate-950">
        読み込み中...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Resume Manager</h1>
            <p className="text-xs text-slate-400">
              {dirty
                ? "未保存の変更があります"
                : resume.updatedAt
                  ? `最終保存: ${formatUpdatedAt(resume.updatedAt)}`
                  : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
        <nav className="mx-auto flex max-w-4xl gap-1 px-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={
                tab === t.id
                  ? "border-b-2 border-slate-900 px-4 py-2 text-sm font-semibold dark:border-slate-100"
                  : "border-b-2 border-transparent px-4 py-2 text-sm text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300"
              }
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-8">
        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
            {error}
          </p>
        )}

        {tab === "profile" && (
          <ProfileForm
            profile={resume.profile}
            onChange={(profile) => update({ profile })}
          />
        )}
        {tab === "skills" && (
          <SkillsEditor
            skills={resume.skills}
            onChange={(skills) => update({ skills })}
          />
        )}
        {tab === "projects" && (
          <ProjectsEditor
            projects={resume.projects}
            onChange={(projects) => update({ projects })}
          />
        )}
        {tab === "import" && <ImportPanel onImport={handleImport} />}
      </div>
    </main>
  );
}

export default App;
