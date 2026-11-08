const BREATH_KEYWORDS = [
  ["sun", /(soleil|sun)/i],
  ["moon", /(lune|moon)/i],
  ["flame", /(flamme|flame)/i],
  ["water", /(eau|water)/i],
  ["wind", /(vent|wind)/i],
  ["thunder", /(foudre|tonnerre|thunder)/i],
  ["stone", /(pierre|stone)/i],
  ["flower", /(fleur|flower)/i],
  ["mist", /(brume|mist)/i],
  ["serpent", /(serpent)/i],
  ["sound", /(son|sound)/i],
  ["insect", /(insecte|insect)/i],
  ["love", /(amour|love)/i],
  ["beast", /(bete|bête|beast)/i],
  ["ocean", /(ocean|océan)/i],
  ["west", /(ouest|west)/i],
  ["snow", /(neige|snow)/i],
  ["custom", /(original|custom|homebrew)/i],
];

export function normalizeBreathName(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return "";
  for (const [key, pattern] of BREATH_KEYWORDS) {
    if (pattern.test(text)) return key;
  }
  return "";
}
