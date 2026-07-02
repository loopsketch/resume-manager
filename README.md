# resume manager

業務履歴書（職務経歴書）やスキルシートを管理するための Windows / Mac デスクトップアプリケーションです。
PDF などで入力した業務履歴書をデータ化して JSON で保持し、アプリ上から業務履歴書・スキルシートを再エクスポートできます。

## 概要

- 業務履歴書（PDF / Word / テキスト等）を取り込み、内容を解析してデータ化します。
- データは JSON 形式で保持し、アプリ上で編集・管理できます。
- 保持したデータから業務履歴書・スキルシートを PDF / テキスト（Markdown）形式でエクスポートできます。

## 主な機能

- **インポート**: PDF 等の業務履歴書を読み込み、経歴・スキル情報を抽出して JSON 化
- **編集・管理**: 取り込んだデータをアプリ上で閲覧・編集
- **エクスポート**:
  - 業務履歴書（PDF / テキスト（Markdown））
  - スキルシート（PDF / テキスト（Markdown））
- **案件マッチング**: 案件の詳細を入力すると、以下を表示
  - 案件の獲得率
  - 商談可能な日程候補（Google カレンダー連携）
  - 要求スキルとのマッチ状況

## 案件マッチング

案件の詳細（業務内容、要求スキル、商談希望日程など）を入力すると、保持している経歴・スキルデータおよび Google カレンダーの予定をもとに、以下を出力します。

- **案件の獲得率**: 経歴・スキルデータと案件の要求内容から算出
- **商談可能な日程候補**: Google カレンダーの空き時間から、商談希望日程に合う候補を提示
- **要求スキルのマッチ**: 要求スキルごとに経験の有無を判定

### 判定方式

ローカル LLM により判定します。

- **推論エンジン**: llama.cpp（llama-server）をサイドカーとしてアプリに同梱し、HTTP 経由で利用（CPU のみで動作）
- **モデル**: 以下いずれかの量子化 GGUF モデル（Q4 クラスの軽量量子化を想定）
  - [Qwen3.5-4B](https://huggingface.co/unsloth/Qwen3.5-4B-GGUF)
  - [Gemma 4 E2B](https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF)
- **獲得率の算出**: LLM で案件詳細・スキルマッチを構造化し、獲得率はルールベースで算出（ハイブリッド方式）
- モデルはインストーラに同梱せず、初回起動時にダウンロードする方式を想定

### 出力例

```
【案件の獲得率】
　72%

【商談の希望日程】
　2026年 4月 21日 11:00開始~12:00終了の間

【要求スキルのマッチ】
　TypeScript 経験 〇
　Claude Code 経験 ×
```

## 技術スタック

- **アプリケーション基盤**: Tauri（Rust + OS 標準 WebView）
- **フロントエンド**: （例）TypeScript / React
- **データ形式**: JSON
- **LLM**: llama.cpp（llama-server サイドカー）+ Qwen3.5-4B / Gemma 4 E2B 量子化 GGUF モデル（ローカル・CPU 動作）
- **外部連携**: Google Calendar API
- **配布形式**: Tauri バンドラによるインストーラ（Windows: NSIS / MSI、Mac: DMG）

> 上記の具体的なライブラリは実装方針が固まり次第更新します。

## データ形式

取り込んだ業務履歴書は JSON として保持します。スキーマ例は今後定義します。

```json
{
  "profile": {
    "name": "",
    "summary": ""
  },
  "skills": [],
  "projects": []
}
```

## 開発環境

開発は各プラットフォーム上でネイティブに行います。

### 前提

- Rust（rustup でインストール）
- Node.js
- Windows の場合: Microsoft Visual Studio Build Tools（C++）、WebView2 ランタイム（Windows 11 は同梱）
- Mac の場合: Xcode Command Line Tools

### セットアップ

```bash
# 依存関係のインストール
npm install

# 開発モードで起動（ホットリロード）
npm run tauri dev
```

## ビルド

```bash
# インストーラをビルド
npm run tauri build
```

- **Windows**: NSIS / MSI インストーラを生成（Windows 上でビルド）
- **Mac**: DMG を生成（署名・公証を含め macOS 上でビルド）

生成物は `src-tauri/target/release/bundle/` に出力されます。

## ディレクトリ構成（予定）

```
resume-manager/
├── src/            # フロントエンド（UI: TypeScript / React）
├── src-tauri/      # Tauri バックエンド（Rust）
│   ├── src/        # Rust ソース
│   └── tauri.conf.json
├── package.json
└── README.md
```

## ライセンス

TBD
