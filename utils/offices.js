// Office name normalisation and "which office handles this location?".
// Aliases map alternative city names to the canonical office name, so
// "Bangalore" and "Bengaluru" are the same office (no duplicates).

const ALIASES = {
  bangalore: 'bengaluru',
  bengaluru: 'bengaluru',
  bengalooru: 'bengaluru',
  'new delhi': 'delhi',
  calcutta: 'kolkata'
};

const DISPLAY = {
  bengaluru: 'Bengaluru',
  delhi: 'Delhi',
  kolkata: 'Kolkata'
};

const clean = (value) => String(value || '')
  .toLowerCase()
  .replace(/[^a-z\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

// Canonical lower-case key for an office or city name ("Bangalore" -> "bengaluru")
const officeKey = (name) => {
  const c = clean(name);
  return ALIASES[c] || c;
};

// Display name to store for a new/renamed office ("bangalore" -> "Bengaluru")
const canonicalOfficeName = (name) => {
  const trimmed = String(name || '').trim().replace(/\s+/g, ' ');
  const key = officeKey(trimmed);
  return DISPLAY[key] || trimmed;
};

// Replace alias words in free text ("HSR Layout, Bangalore" -> "hsr layout bengaluru")
const normaliseLocationText = (text) => {
  let c = ` ${clean(text)} `;
  for (const [alias, canonical] of Object.entries(ALIASES)) {
    c = c.split(` ${alias} `).join(` ${canonical} `);
  }
  return c;
};

// Pick the office whose (normalised) name appears as a word in the location text.
// Longest name wins, so "New Delhi" style names beat shorter partial matches.
const findOfficeForLocation = (location, offices) => {
  if (!location) return null;
  const text = normaliseLocationText(location);
  const matches = offices.filter(o => text.includes(` ${officeKey(o.name)} `));
  if (!matches.length) return null;
  return matches.sort((a, b) => officeKey(b.name).length - officeKey(a.name).length)[0];
};

module.exports = { officeKey, canonicalOfficeName, findOfficeForLocation };
