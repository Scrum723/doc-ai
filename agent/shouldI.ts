/**
 * Rule-based household decision from stored weather facts.
 * Alexa+ voices the result; this module only returns yes / caution / no.
 */
import { spoken } from "./voice.js";
import type { GlanceCard } from "./card.js";

export type Decision = "yes" | "caution" | "no";

export type ActivityId =
  | "leave_hose"
  | "cover_grill"
  | "walk_dog"
  | "drive"
  | "leave_boat"
  | "general";

export type ShouldIFacts = {
  locationLabel: string;
  tempF: number | null;
  minTempF: number | null;
  windMph: number | null;
  precipIn: number | null;
  conditionText: string;
  forecastTexts: string[];
  forecastPrecip: number[];
  alertEvents: string[];
};

export type ShouldIResult = {
  activity: ActivityId;
  decision: Decision;
  title: string;
  reason: string;
  action: string;
  spoken: string;
  card: GlanceCard;
};

const ACTIVITY_PATTERNS: { id: ActivityId; re: RegExp }[] = [
  { id: "leave_hose", re: /hose|spigot|faucet|pipe|outdoor tap/ },
  { id: "cover_grill", re: /grill|bbq|barbecue/ },
  { id: "walk_dog", re: /dog|walk the|pet/ },
  { id: "drive", re: /drive|commute|road|car/ },
  { id: "leave_boat", re: /boat|dock|launch|cover the boat/ },
];

export function parseActivity(raw?: string): ActivityId {
  const s = (raw || "").toLowerCase();
  for (const p of ACTIVITY_PATTERNS) {
    if (p.re.test(s)) return p.id;
  }
  return "general";
}

function joinedAlerts(events: string[]): string {
  return events.join(" ").toLowerCase();
}

export function freezeBand(facts: ShouldIFacts): "none" | "near" | "likely" {
  const blob = `${joinedAlerts(facts.alertEvents)} ${facts.forecastTexts.join(" ")}`;
  if (/hard freeze|freeze warning|frost advisory|ice storm/.test(blob)) return "likely";
  const overnight =
    facts.minTempF ?? (facts.tempF != null ? facts.tempF - 10 : null);
  if (overnight != null && overnight <= 32) return "likely";
  if (facts.tempF != null && facts.tempF <= 32) return "likely";
  if (overnight != null && overnight <= 36) return "near";
  if (facts.tempF != null && facts.tempF <= 35) return "near";
  if (/\bfrost\b|\bfreeze\b/.test(blob) && (overnight == null || overnight <= 40)) return "near";
  return "none";
}

export function rainSoon(facts: ShouldIFacts): boolean {
  const precip = facts.forecastPrecip.slice(0, 2).reduce((a, b) => a + (b || 0), 0) + (facts.precipIn || 0);
  if (precip >= 0.15) return true;
  const blob = `${facts.conditionText} ${facts.forecastTexts.slice(0, 2).join(" ")}`.toLowerCase();
  return /rain|shower|storm|thunder|snow/.test(blob);
}

export function windy(facts: ShouldIFacts): boolean {
  if ((facts.windMph ?? 0) >= 25) return true;
  return /wind|gale/.test(joinedAlerts(facts.alertEvents));
}

function pack(
  activity: ActivityId,
  decision: Decision,
  title: string,
  reason: string,
  action: string
): ShouldIResult {
  const spokenLine = spoken(`${title} ${reason} ${action}`);
  return {
    activity,
    decision,
    title,
    reason,
    action,
    spoken: spokenLine,
    card: {
      headline: title,
      supporting: reason,
      chip: decision === "yes" ? "Go ahead" : decision === "caution" ? "Caution" : "Don't",
      decision,
      action,
    },
  };
}

export function decideShouldI(activity: ActivityId, facts: ShouldIFacts): ShouldIResult {
  const freeze = freezeBand(facts);
  const rain = rainSoon(facts);
  const wind = windy(facts);
  const loc = facts.locationLabel;
  const overnight = facts.minTempF ?? facts.tempF;

  if (activity === "leave_hose") {
    if (freeze === "likely") {
      return pack(
        activity,
        "no",
        "No.",
        `Freeze risk in ${loc}. Overnight low around ${overnight ?? "freezing"} degrees.`,
        "Disconnect and drain the hose."
      );
    }
    if (freeze === "near") {
      return pack(
        activity,
        "caution",
        "Caution.",
        `Temps in ${loc} are close to freezing.`,
        "Bring the hose in if the overnight low drops."
      );
    }
    return pack(
      activity,
      "yes",
      "Yes.",
      `Overnight lows in ${loc} stay above freezing.`,
      "You can leave the hose connected."
    );
  }

  if (activity === "cover_grill") {
    if (rain || wind) {
      return pack(
        activity,
        "yes",
        "Yes.",
        `${rain ? "Rain" : "Wind"} is in the ${loc} outlook.`,
        "Cover the grill."
      );
    }
    return pack(
      activity,
      "no",
      "No need.",
      `Skies stay mostly dry in ${loc}.`,
      "Leave the grill uncovered."
    );
  }

  if (activity === "leave_boat") {
    if (wind || rain || freeze === "likely") {
      return pack(
        activity,
        "no",
        "No.",
        `Wind, rain, or freeze is in the ${loc} outlook.`,
        "Cover the boat and check lines."
      );
    }
    return pack(
      activity,
      "yes",
      "Yes.",
      `Conditions look workable on the water near ${loc}.`,
      "Still check lines before you leave."
    );
  }

  if (activity === "walk_dog") {
    const severe = /warning|tornado|thunder|blizzard|extreme/.test(joinedAlerts(facts.alertEvents));
    if (severe || freeze === "likely" || (facts.tempF != null && facts.tempF >= 92)) {
      return pack(
        activity,
        "no",
        "No.",
        `Weather in ${loc} is too rough for a long walk.`,
        "Keep the walk short or wait it out."
      );
    }
    if (wind || rain || freeze === "near") {
      return pack(
        activity,
        "caution",
        "Caution.",
        `It is ${facts.conditionText.toLowerCase() || "unsettled"} in ${loc}.`,
        "A short walk is fine. Skip the long loop."
      );
    }
    return pack(
      activity,
      "yes",
      "Yes.",
      `It is about ${facts.tempF ?? "unknown"} degrees in ${loc}.`,
      "Good window for a walk."
    );
  }

  if (activity === "drive") {
    const ice = /ice|winter|blizzard|flood|visibility/.test(joinedAlerts(facts.alertEvents));
    if (ice || freeze === "likely") {
      return pack(
        activity,
        "caution",
        "Caution.",
        `Winter or low-visibility risk is on the ${loc} board.`,
        "Leave extra time and watch the roads."
      );
    }
    return pack(
      activity,
      "yes",
      "Yes.",
      `No winter travel alerts stored for ${loc}.`,
      "Drive as usual."
    );
  }

  if (freeze === "likely" || /warning/.test(joinedAlerts(facts.alertEvents))) {
    return pack(
      activity,
      "caution",
      "Caution.",
      `Active weather in ${loc} needs a look before you head out.`,
      "Ask about the hose, the grill, or a freeze watch."
    );
  }
  return pack(
    activity,
    "yes",
    "Yes.",
    `Nothing blocking household plans in ${loc} right now.`,
    "Ask should I leave the hose out, or should I cover the grill, for a specific call."
  );
}
