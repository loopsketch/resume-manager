import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(await invoke("greet", { name }));
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight">Resume Manager</h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            業務履歴書・スキルシートを管理するデスクトップアプリ
          </p>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 text-lg font-semibold">動作確認 (Rust ブリッジ)</h2>
          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              greet();
            }}
          >
            <input
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:focus:ring-slate-700"
              onChange={(e) => setName(e.currentTarget.value)}
              placeholder="名前を入力..."
              value={name}
            />
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
            >
              Greet
            </button>
          </form>
          {greetMsg && (
            <p className="mt-4 rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
              {greetMsg}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

export default App;
