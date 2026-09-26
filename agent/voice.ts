/**
 * Voice formatter for Alexa+: short spoken-style sentences, no markdown.
 */
const MD = /[`*_#\[\]()>~|]/g;

export function spoken(text: string): string {
  let s = text.replace(MD, " ");
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/https?:\/\/\S+/g, "");
  if (!s.endsWith(".") && !s.endsWith("?") && !s.endsWith("!")) s += ".";
  return s;
}

export function joinSpoken(parts: string[]): string {
  return spoken(parts.filter(Boolean).join(" "));
}
