/**
 * Pure helpers for `daily-spark`: naming, date keys, style choice from taste,
 * and a date-derived seed. No framework or database imports.
 */

import { hashSeed } from "./random";
import type { SeedStyle } from "./seed";

export const SPARK_NAME_PREFIX = "Spark — ";

export const SPARK_BARS = 2;

export interface TasteSignalInput {
  signal: string;
  weight: number;
}

const HOUSE_HINTS = [
  "house",
  "four on the floor",
  "four-on-the-floor",
  "offbeat",
  "driving",
  "bright",
];

const LOFI_HINTS = ["lofi", "lo-fi", "dusty", "swing", "mellow", "minor"];

/** Local calendar date as YYYY-MM-DD. Same date -> same key. */
export function sparkDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function sparkSessionName(dateKey: string): string {
  return `${SPARK_NAME_PREFIX}${dateKey}`;
}

export function isSparkSessionName(name: string): boolean {
  return name.startsWith(SPARK_NAME_PREFIX);
}

/**
 * Picks a starting style from liked (positive-weight) taste signals. Ties and
 * no signal fall back to lo-fi, the product default.
 */
export function pickSparkStyle(signals: readonly TasteSignalInput[]): SeedStyle {
  let house = 0;
  let lofi = 0;
  for (const entry of signals) {
    if (!(entry.weight > 0)) continue;
    const text = entry.signal.toLowerCase();
    for (const hint of HOUSE_HINTS) if (text.includes(hint)) house += entry.weight;
    for (const hint of LOFI_HINTS) if (text.includes(hint)) lofi += entry.weight;
  }
  return house > lofi ? "house" : "lofi";
}

/** Stable per-date, per-row seed for the vary pass. */
export function sparkRowSeed(dateKey: string, track: string): number {
  return hashSeed(["daily-spark", dateKey, track]);
}

/** Tempo for a style, matching the seed values the jam home page uses. */
export function sparkBpm(style: SeedStyle): number {
  return style === "house" ? 124 : 82;
}
