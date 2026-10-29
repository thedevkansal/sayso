/** Cuts the recorded take (and the real Wispr Flow clip) to the voiceover timing and muxes the audio. */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const segs = JSON.parse(readFileSync("video/segments.json", "utf8"));
const marks = JSON.parse(readFileSync("video/marks.json", "utf8"));
const OFFSET = Number(process.env.OFFSET || 0); // shift if the recording started late
const at = (id, part = 0) => marks.find((m) => m.id === id && m.part === part).at + OFFSET;
const V = ["-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", "-r", "30", "-an"];
const FIT = "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0xf3f3f1,setsar=1";

mkdirSync("video/parts", { recursive: true });
const parts = [];
const cut = (name, src, from, dur, vf = FIT) => {
  const out = `video/parts/${name}.mp4`;
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", from.toFixed(3), "-i", src, "-t", dur.toFixed(3), "-vf", `${vf},tpad=stop_mode=clone:stop_duration=${dur.toFixed(3)}`, "-t", dur.toFixed(3), ...V, out]);
  parts.push(out);
};

for (const s of segs) {
  const dur = s.end - s.start;
  if (s.id === "p05") {
    // Real Wispr Flow: the listening pill while the line is spoken (crop 16:10 → 16:9 keeping the composer).
    const flowDur = 5.0;
    cut("p05a", "video/flow.mp4", 8.0, flowDur, "crop=2880:1620:0:180,scale=1920:1080,setsar=1");
    cut("p05b", "video/raw/take.webm", at("p05") + flowDur, dur - flowDur);
  } else if (s.id === "p13") {
    const a = 2.6;
    cut("p13a", "video/raw/take.webm", at("p13", 0), a);
    cut("p13b", "video/raw/take.webm", at("p13", 1), dur - a);
  } else {
    cut(s.id, "video/raw/take.webm", at(s.id), dur);
  }
}

writeFileSync("video/parts/list.txt", parts.map((p) => `file '${p.replace("video/parts/", "")}'`).join("\n"));
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", "video/parts/list.txt", "-c", "copy", "video/parts/silent.mp4"]);
execFileSync("ffmpeg", [
  "-y", "-loglevel", "error", "-i", "video/parts/silent.mp4", "-i", "video/voice.mp3",
  "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart",
  "video/sayso-demo.mp4",
]);
console.log("built video/sayso-demo.mp4 from", parts.length, "parts");
