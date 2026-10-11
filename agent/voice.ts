/**
 * Voice formatter for Alexa+: short spoken-style sentences, no markdown.
 * Lead with the answer, then one useful detail.
 */
const MD = /[`*_#\[\]()>~|]/g;

export function spoken(text: string): string {
  let s = text.replace(MD, " ");
  s = s.replace(/https?:\/\/\S+/gi, "");
  s = s.replace(/^\s*(?:[-•]|\d+\.)\s+/gm, "");
  s = s.replace(/\s+/g, " ").trim();
  if (!s.endsWith(".") && !s.endsWith("?") && !s.endsWith("!")) s += ".";
  return s;
}

export function joinSpoken(parts: string[]): string {
  return spoken(parts.filter(Boolean).join(" "));
}

/** "It's 72 and sunny in Rochester. Rain moves in around four." */
export function spokenLead(
  place: string,
  temp: number | string | null | undefined,
  cond: string,
  detail?: string
): string {
  const sky = (cond || "the sky is mixed").replace(/\.$/, "");
  const lead =
    temp == null || temp === ""
      ? `I don't have a live temperature for ${place} yet.`
      : `It's ${temp} and ${sky} in ${place}.`;
  return joinSpoken([lead, detail || ""]);
}
