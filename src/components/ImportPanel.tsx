import { useEffect, useRef, useState } from "react";
import {
  getLlmStatus,
  onDownloadProgress,
  setupLlm,
  startLlm,
  stopLlm,
  extractResume,
  type DownloadProgress,
  type LlmStatus,
} from "../lib/llm";
import {
  normalizeExtracted,
  type ImportMode,
  type ResumePatch,
} from "../lib/importResume";
import { extractPdfText } from "../lib/pdf";

const MAX_ANALYZE_CHARS = 10_000;

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={
        ok
          ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
          : "rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-400 dark:bg-slate-800"
      }
    >
      {ok ? "✓" : "−"} {label}
    </span>
  );
}

function ProgressBar({ progress }: { progress: DownloadProgress }) {
  const label = progress.stage === "binary" ? "llama-server" : "モデル (GGUF)";
  const percent =
    progress.total && progress.total > 0
      ? Math.min(100, (progress.downloaded / progress.total) * 100)
      : null;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>{label}</span>
        <span>
          {formatBytes(progress.downloaded)}
          {progress.total ? ` / ${formatBytes(progress.total)}` : ""}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-slate-900 transition-all dark:bg-slate-100"
          style={{ width: percent !== null ? `${percent}%` : "100%" }}
        />
      </div>
    </div>
  );
}

const primaryButton =
  "rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300";
const secondaryButton =
  "rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium transition hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800";

export function ImportPanel({
  onImport,
}: {
  onImport: (patch: ResumePatch, mode: ImportMode) => void;
}) {
  const [status, setStatus] = useState<LlmStatus | null>(null);
  const [progress, setProgress] = useState<Partial<Record<string, DownloadProgress>>>({});
  const [settingUp, setSettingUp] = useState(false);
  const [starting, setStarting] = useState(false);
  const [reading, setReading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [fileName, setFileName] = useState("");
  const [text, setText] = useState("");
  const [result, setResult] = useState<ResumePatch | null>(null);
  const [imported, setImported] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshStatus = () => {
    getLlmStatus().then(setStatus).catch(() => {});
  };

  useEffect(() => {
    refreshStatus();
    const timer = setInterval(refreshStatus, 5000);
    const unlistenPromise = onDownloadProgress((p) =>
      setProgress((prev) => ({ ...prev, [p.stage]: p })),
    );
    return () => {
      clearInterval(timer);
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  const handleSetup = async () => {
    setSettingUp(true);
    setError("");
    setProgress({});
    try {
      await setupLlm();
      refreshStatus();
      // セットアップ完了後、そのまま起動する
      setStarting(true);
      await startLlm();
    } catch (e) {
      setError(String(e));
    } finally {
      setSettingUp(false);
      setStarting(false);
      refreshStatus();
    }
  };

  const handleStart = async () => {
    setStarting(true);
    setError("");
    try {
      await startLlm();
    } catch (e) {
      setError(String(e));
    } finally {
      setStarting(false);
      refreshStatus();
    }
  };

  const handleStop = async () => {
    setError("");
    try {
      await stopLlm();
    } catch (e) {
      setError(String(e));
    } finally {
      refreshStatus();
    }
  };

  const handleFile = async (file: File) => {
    setReading(true);
    setError("");
    setResult(null);
    setImported(false);
    setFileName(file.name);
    try {
      if (file.name.toLowerCase().endsWith(".pdf")) {
        setText(await extractPdfText(await file.arrayBuffer()));
      } else {
        setText(await file.text());
      }
    } catch (e) {
      setError(`ファイルの読み込みに失敗しました: ${e}`);
      setFileName("");
    } finally {
      setReading(false);
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError("");
    setResult(null);
    setImported(false);
    try {
      const extracted = await extractResume(text);
      setResult(normalizeExtracted(extracted));
    } catch (e) {
      setError(String(e));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleImport = (mode: ImportMode) => {
    if (!result) return;
    onImport(result, mode);
    setImported(true);
  };

  const installed = !!status?.binaryInstalled && !!status?.modelInstalled;
  const ready = !!status?.ready;
  const busy = settingUp || starting;

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
          {error}
        </p>
      )}

      {/* ローカル LLM */}
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">ローカル LLM (llama.cpp)</h2>
          <div className="flex gap-2">
            <StatusBadge ok={!!status?.binaryInstalled} label="実行環境" />
            <StatusBadge ok={!!status?.modelInstalled} label="モデル" />
            <StatusBadge ok={ready} label="起動中" />
          </div>
        </div>

        {(settingUp || Object.keys(progress).length > 0) && (
          <div className="space-y-3">
            {progress.binary && <ProgressBar progress={progress.binary} />}
            {progress.model && <ProgressBar progress={progress.model} />}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {!installed && (
            <button
              type="button"
              className={primaryButton}
              onClick={handleSetup}
              disabled={busy}
            >
              {settingUp ? "セットアップ中..." : "セットアップ（約 2.8GB をダウンロード）"}
            </button>
          )}
          {installed && !ready && (
            <button
              type="button"
              className={primaryButton}
              onClick={handleStart}
              disabled={busy}
            >
              {starting ? "起動中（モデル読み込み）..." : "LLM を起動"}
            </button>
          )}
          {ready && (
            <button type="button" className={secondaryButton} onClick={handleStop}>
              LLM を停止
            </button>
          )}
          <p className="text-xs text-slate-400">
            Qwen3.5-4B (Q4_K_M) をローカル実行します (GPU があれば自動利用 / なければ
            CPU)。データは外部に送信されません。
          </p>
        </div>
      </section>

      {/* ファイル取り込み */}
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-semibold">業務履歴書の取り込み</h2>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={secondaryButton}
            onClick={() => fileInputRef.current?.click()}
            disabled={reading}
          >
            {reading ? "読み込み中..." : "ファイルを選択 (PDF / テキスト)"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md,.text"
            className="hidden"
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              if (file) handleFile(file);
              e.currentTarget.value = "";
            }}
          />
          {fileName && <span className="text-sm text-slate-500">{fileName}</span>}
        </div>

        {text && (
          <div>
            <div className="mb-1 flex justify-between text-xs text-slate-400">
              <span>抽出テキスト（編集できます）</span>
              <span>
                {text.length.toLocaleString()} 文字
                {text.length > MAX_ANALYZE_CHARS &&
                  ` — 先頭 ${MAX_ANALYZE_CHARS.toLocaleString()} 文字のみ解析されます`}
              </span>
            </div>
            <textarea
              className="h-48 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:focus:ring-slate-700"
              value={text}
              onChange={(e) => setText(e.currentTarget.value)}
            />
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            className={primaryButton}
            onClick={handleAnalyze}
            disabled={!ready || !text.trim() || analyzing}
          >
            {analyzing ? "解析中..." : "LLM で解析"}
          </button>
          {!ready && text && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              解析には LLM の起動が必要です
            </p>
          )}
          {analyzing && (
            <p className="text-xs text-slate-400">
              CPU で推論しています。数分かかることがあります...
            </p>
          )}
        </div>
      </section>

      {/* 解析結果 */}
      {result && (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-semibold">解析結果</h2>
          <div className="grid gap-4 text-sm sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
              <p className="text-xs text-slate-400">プロフィール</p>
              <p className="mt-1 font-medium">{result.profile.name || "（氏名なし）"}</p>
              <p className="text-xs text-slate-500">
                {result.profile.summary
                  ? `${result.profile.summary.slice(0, 60)}...`
                  : "概要なし"}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
              <p className="text-xs text-slate-400">スキル</p>
              <p className="mt-1 font-medium">{result.skills.length} 件</p>
              <p className="truncate text-xs text-slate-500">
                {result.skills.map((s) => s.name).join(", ")}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
              <p className="text-xs text-slate-400">職務経歴</p>
              <p className="mt-1 font-medium">{result.projects.length} 件</p>
              <p className="truncate text-xs text-slate-500">
                {result.projects.map((p) => p.name).join(" / ")}
              </p>
            </div>
          </div>

          {imported ? (
            <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
              取り込みました。各タブで内容を確認し、保存してください。
            </p>
          ) : (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className={primaryButton}
                onClick={() => handleImport("append")}
              >
                追記で取り込む
              </button>
              <button
                type="button"
                className={secondaryButton}
                onClick={() => handleImport("replace")}
              >
                置き換えで取り込む
              </button>
              <p className="self-center text-xs text-slate-400">
                追記: 既存データを保持して追加 / 置き換え: 抽出結果で上書き
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
