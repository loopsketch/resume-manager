import type { Profile } from "../types/resume";
import { TextArea, TextField } from "./fields";

export function ProfileForm({
  profile,
  onChange,
}: {
  profile: Profile;
  onChange: (profile: Profile) => void;
}) {
  const update = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    onChange({ ...profile, [key]: value });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="氏名"
          value={profile.name}
          onChange={(v) => update("name", v)}
          placeholder="山田 太郎"
        />
        <TextField
          label="ふりがな"
          value={profile.nameKana}
          onChange={(v) => update("nameKana", v)}
          placeholder="やまだ たろう"
        />
        <TextField
          label="生年月"
          type="month"
          value={profile.birthMonth}
          onChange={(v) => update("birthMonth", v)}
        />
        <TextField
          label="最寄り駅・所在地"
          value={profile.location}
          onChange={(v) => update("location", v)}
          placeholder="東京都 / JR山手線 渋谷駅"
        />
      </div>
      <TextField
        label="学歴"
        value={profile.education}
        onChange={(v) => update("education", v)}
        placeholder="〇〇大学 〇〇学部 卒業"
      />
      <TextArea
        label="自己PR・概要"
        value={profile.summary}
        onChange={(v) => update("summary", v)}
        placeholder="経験の概要や強みを記載します"
        rows={6}
      />
    </div>
  );
}
