import type { Locale } from "../config";
import en, { type Dictionary } from "./en";
import hi from "./hi";

export type { Dictionary };

const DICTIONARIES: Record<Locale, Dictionary> = { en, hi };

export function dictionaryFor(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}
