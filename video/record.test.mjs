import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SHOTS, TOTAL_SECONDS, auditionSnapshot, fitScaleForShot, mappedShotTime, rewindWav, spokenRationale, subtitleSegments } from "../../video/record.mjs";

const countWords = (text) => (text.match(/[\w’'-]+/g) || []).length;

it("inserts beat 6b between approval and the knob on an uninterrupted 150-second timeline", () => {
  expect(SHOTS.map((shot) => shot.number)).toEqual([1, 2, 3, 4, 5, 6, "6b", 7, 8, 9, 10]);
  expect(TOTAL_SECONDS).toBe(150);
  let end = 0;
  for (const shot of SHOTS) {
    expect(shot.start).toBe(end);
    end += shot.duration;
  }
  expect(end).toBe(TOTAL_SECONDS);
  expect(SHOTS.find((shot) => shot.number === "6b").compressWait).toBe(true);
});

describe("spoken bandmate ideas", () => {
  it("describes the actual changed track and location in at most sixteen words", () => {
    const tracks = [
      { kind: "snare", steps: Array(128).fill(0) },
      { kind: "bass", steps: Array(128).fill(null) },
      { kind: "keys", steps: Array(8).fill("i") },
    ];
    const cases = [
      ["Drummer", [{ track: "snare", fromStep: 124, steps: [1, 2, 2, 3] }], "near the ending"],
      ["Bassist", [{ track: "bass", fromStep: 17, steps: [2, 3] }], "bar two"],
      ["Keys", [{ track: "keys", fromStep: 3, steps: ["VI"] }], "bar four"],
      ["Keys", [{ track: "keys", fromStep: 7, steps: ["V"] }], "final chord"],
    ];
    for (const [role, patch, location] of cases) {
      const rationale = spokenRationale(role, "A new musical idea.", patch, tracks, 8);
      const line = `${role} here. ${rationale}`;
      expect(line).toContain(location);
      expect(line).toMatch(/I'll/);
      expect(line).not.toMatch(/\d/);
      expect(countWords(line)).toBeLessThanOrEqual(16);
    }
  });

  it("does not describe unchanged patch entries as changed bars", () => {
    const line = spokenRationale("Keys", "warm chords", [{ track: "keys", fromStep: 0, steps: ["i", "VI", "i"] }], [{ kind: "keys", steps: ["i", "i", "i"] }]);
    expect(line).toContain("bar two");
  });
});

describe("subtitle timing", () => {
  it("uses provider word times and labels every bandmate chunk", () => {
    const subtitles = subtitleSegments([{ beat: 5, role: "Drummer", timestamp: 40, duration: 4,
      text: "Drummer here. I'll add quiet snare notes near the ending.",
      words: [{ text: "Drummer", start: .1, end: .5 }, { text: "here.", start: .5, end: .8 },
        { text: "I'll", start: 1, end: 1.2 }, { text: "add", start: 1.2, end: 1.5 }, { text: "quiet", start: 1.5, end: 1.8 },
        { text: "snare", start: 1.8, end: 2.2 }, { text: "notes", start: 2.2, end: 2.5 }, { text: "near", start: 2.5, end: 2.8 },
        { text: "the", start: 2.8, end: 3 }, { text: "ending.", start: 3, end: 3.6 }] }]);
    expect(subtitles[0].start).toBeCloseTo(40.1);
    expect(subtitles.at(-1).end).toBeCloseTo(43.72);
    expect(subtitles.every((cue) => cue.text.startsWith("DRUMMER — "))).toBe(true);
  });

  it("keeps all words, readable chunk lengths, and nonoverlapping times without alignment", () => {
    const text = "Under the hood, it's Agent-Native. A click, a bandmate's idea, Claude's suggestion: it's all the same action. So people and agents really play on one loop.";
    const subtitles = subtitleSegments([{ role: "Narrator", beat: 9, timestamp: 110, duration: 12.8, text }]);
    expect(subtitles.map((cue) => cue.text).join(" ")).toBe(text);
    for (let index = 0; index < subtitles.length; index++) {
      const cue = subtitles[index];
      expect(cue.text.length).toBeLessThanOrEqual(84);
      expect(cue.end).toBeGreaterThan(cue.start);
      expect(cue.end).toBeLessThanOrEqual(123);
      if (index) expect(cue.start).toBeGreaterThanOrEqual(subtitles[index - 1].end);
    }
  });
});

it("cuts a long real wait while preserving its entrance, exit, and later state timings", () => {
  const shot = { realStart: 1000, duration: 24, compressWait: true, marks: { waitStart: 3000, waitEnd: 33000 } };
  expect(mappedShotTime(shot, 3250)).toBeCloseTo(2.25);
  expect(mappedShotTime(shot, 20000)).toBeCloseTo(2.75);
  expect(mappedShotTime(shot, 32750)).toBeCloseTo(3.25);
  expect(mappedShotTime(shot, 34000)).toBeCloseTo(4.5);
});

it("fits slow UI actions without cutting off the last keep or its music state", () => {
  const shot = { realStart: 1000, realEnd: 31000, duration: 20, marks: {} };
  shot.fitScale = fitScaleForShot(shot);
  expect(mappedShotTime(shot, 25000)).toBeCloseTo(16);
  expect(mappedShotTime(shot, shot.realEnd)).toBeCloseTo(20);
  const waited = { realStart: 1000, realEnd: 61000, duration: 24, compressWait: true,
    marks: { waitStart: 3000, waitEnd: 33000 } };
  waited.fitScale = fitScaleForShot(waited);
  expect(mappedShotTime(waited, 61000)).toBeCloseTo(24);
  expect(mappedShotTime(waited, 55000)).toBeLessThan(20);
});

it("renders an audition's actual patch without mutating the kept session", () => {
  const state = { tracks: [{ kind: "snare", steps: [0, 0, 0] }] };
  const result = auditionSnapshot(state, { patch: [{ track: "snare", fromStep: 1, steps: [2, 3] }] });
  expect(result.tracks[0].steps).toEqual([0, 2, 3]);
  expect(state.tracks[0].steps).toEqual([0, 0, 0]);
});

it("synthesizes a deterministic six-tenths-second PCM rewind without external assets", () => {
  const wav = rewindWav();
  expect(wav.subarray(0, 4).toString()).toBe("RIFF");
  expect(wav.readUInt32LE(24)).toBe(44100);
  expect(wav.readUInt32LE(40) / 2 / 44100).toBeCloseTo(.6);
  expect(wav).toEqual(rewindWav());
});

it("deduplicates ElevenLabs requests, never charges cached text, and aborts before an oversized plan", () => {
  const filename = fileURLToPath(new URL("../../video/make_vo.py", import.meta.url));
  const script = `
import importlib.util, pathlib, tempfile, json
spec = importlib.util.spec_from_file_location('jam_vo', ${JSON.stringify(filename)})
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as directory:
    cache = pathlib.Path(directory)
    line = {'voice_id': 'voice', 'text': 'Hello band.'}
    first = m.plan_new_characters([line, line], cache)
    key = m.cache_key('voice', m.ELEVEN_MODEL, line['text'])
    (cache / (key + '.mp3')).write_bytes(b'cached')
    cached = m.plan_new_characters([line], cache)
    blocked = False
    try:
        m.plan_new_characters([{'voice_id': 'voice', 'text': 'x' * 3001}], cache)
    except RuntimeError:
        blocked = True
    print(json.dumps({'first': first, 'cached': cached, 'blocked': blocked, 'key': key,
        'duration': m.FULL_LENGTH_SECONDS, 'narration': m.NARRATION}))
`;
  const result = JSON.parse(execFileSync("python3", ["-B", "-c", script], { encoding: "utf8" }));
  expect(result.first).toBe(11);
  expect(result.cached).toBe(0);
  expect(result.blocked).toBe(true);
  expect(result.key).toMatch(/^[0-9a-f]{64}$/);
  expect(result.duration).toBe(TOTAL_SECONDS);
  expect(result.narration.find((line) => line[0] === "6b").slice(1, 3)).toEqual([82, 97]);
  for (const [beat, start, end] of result.narration) {
    const shot = SHOTS.find((shot) => shot.number === beat);
    expect(start).toBeGreaterThanOrEqual(shot.start);
    expect(end).toBeLessThanOrEqual(shot.start + shot.duration);
  }
});
