import { apiUrl } from "./apiBase";

export interface DictionaryEntry {
  id?: number | string;
  transliteration?: string;
  meaning?: string;
  tla_id?: string;
  [key: string]: any;
}

export async function fetchDictionaryEntry(dictId: string, id: number | string) {
  try {
    const response = await fetch(apiUrl(`/dictionary/${dictId}/byid?id=${id}`));
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return data as DictionaryEntry | null;
  } catch (error) {
    console.error("Dictionary fetch failed:", error);
    return null;
  }
}
