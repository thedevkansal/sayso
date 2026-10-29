import { GoogleGenAI } from "@google/genai";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
process.loadEnvFile(".env.local");
const S = `2.585011-3.210431 4.376803-4.958322 6.389705-7.193787 10.095533-10.746757 12.150748-12.64161 16.111202-16.744444 18.899297-19.379592 20.772971-21.563379 22.610862-23.109796 24.409592-25.016032 29.507732-30.028753 30.724807-31.195873 33.906372-34.410045 42.716893-43.188322 43.364875-43.901882 47.178231-47.641723 48.933016-49.463333 53.232132-53.70449 59.915488-60.433832 62.460249-62.974172 68.618413-69.127234 70.694354-71.160771 84.685057-85.164762 95.795941-96.304626 99.445102-100.109546`.split(" ").map(s=>s.split("-").map(Number));
const cuts = [0, ...S.map(([a,b])=>(a+b)/2), 105.64];
mkdirSync("video/chunks", { recursive: true });
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const out = [];
const FROM = Number(process.env.FROM || 0);
for (let i = 0; i < cuts.length - 1; i++) {
  if (i < FROM) continue;
  await new Promise(r => setTimeout(r, 6500));
  const f = `video/chunks/c${String(i).padStart(2,"0")}.mp3`;
  execFileSync("ffmpeg", ["-y","-loglevel","error","-i","video/voice.mp3","-ss",String(cuts[i]),"-to",String(cuts[i+1]),f]);
  const res = await ai.models.generateContent({
    model: "gemini-3.5-flash-lite",
    contents: [{ role: "user", parts: [{ inlineData: { mimeType: "audio/mpeg", data: readFileSync(f).toString("base64") } }, { text: "Transcribe this short audio clip verbatim. Output only the words." }] }],
  });
  out.push({ i, start: +cuts[i].toFixed(2), end: +cuts[i+1].toFixed(2), text: res.text.trim() });
  console.log(i, cuts[i].toFixed(2), "|", res.text.trim());
}
writeFileSync("video/chunks.json", JSON.stringify(out, null, 1));
