import fs from "node:fs";

// Original vector pictograms, matched to the paper sheet's ink and teal palette.
const symbols = {
  weapon: '<path d="m20 44 22-26 6-2-1 6-23 26m-8-9 13 12m-12-8-6 7 4 4 7-7"/>',
  firearm: '<path d="M12 23h40v9H31l-4 17H16l5-17h-9Zm23 9v8h9l3-8M15 19h5m26 0h4"/>',
  ammunition: '<path d="M17 48V24l6-10 6 10v24Zm18 0V24l6-10 6 10v24ZM17 39h12m6 0h12M15 49h16m2 0h16"/>',
  explosive: '<circle cx="31" cy="38" r="16"/><path d="m36 23 3-7 6 3m-3-3 3-7m3 7 6-2m-18-2-3-5M22 33l3-4"/>',
  technique: '<path d="M12 43c22 1 35-12 40-26-1 26-22 34-40 26Zm4-13 5-6m8-9 2-5m13 34 6 5"/>',
  breath: '<path d="M10 25h31c12 0 12-17 1-17-5 0-7 3-7 6M10 34h39c10 0 10 15 0 15-4 0-6-2-6-5M14 43h17c8 0 8 13 0 13"/>',
  blood: '<path d="M32 9c-5 10-18 21-18 31a18 18 0 0 0 36 0C50 30 37 19 32 9ZM22 37c-2 6 1 11 7 12"/>',
  medical: '<rect x="10" y="20" width="44" height="32" rx="4"/><path d="M23 20v-7h18v7m-9 10v13m-7-6h14"/>',
  poison: '<path d="M25 11h14m-12 0v15L14 47c-2 4 0 7 5 7h26c5 0 7-3 5-7L37 26V11M22 37h20"/><circle cx="28" cy="45" r="1"/><circle cx="37" cy="48" r="1"/>',
  food: '<path d="M10 32h44c-2 14-10 20-22 20S12 46 10 32Zm13 20v4h18v-4M22 24c-6-7 6-8 0-15m12 15c-6-7 6-8 0-15m12 15c-6-7 6-8 0-15"/>',
  clothing: '<path d="m23 12-15 9 7 14 8-5v23h18V30l8 5 7-14-15-9-9 8-9-8Zm0 0 9 41m9-41L27 35m-4 4h18"/>',
  transport: '<path d="M10 21h38l6 22H12Zm9 0 5-10h14l5 10M12 34h39m-20-13v13"/><circle cx="21" cy="48" r="6"/><circle cx="45" cy="48" r="6"/>',
  tools: '<path d="m39 10-4 10 8 8 10-4c1 12-10 18-19 13L18 53l-7-7 17-16c-5-9 0-20 11-20Z"/>',
  feature: '<path d="m32 9 7 15 16 2-12 12 3 17-14-8-14 8 3-17L9 26l16-2Z"/>',
  sense: '<path d="M7 32s10-17 25-17 25 17 25 17-10 17-25 17S7 32 7 32Z"/><circle cx="32" cy="32" r="9"/><circle cx="32" cy="32" r="2"/>',
  gear: '<path d="M22 20v-7h20v7M16 22h32l4 32H12Zm0 10h32M25 28v9m14-9v9"/>',
};
const output = new URL("../../assets/icons/items/", import.meta.url);
fs.mkdirSync(output, { recursive: true });
for (const [name, paths] of Object.entries(symbols)) {
  fs.writeFileSync(new URL(`${name}.svg`, output), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="1" y="1" width="62" height="62" rx="12" fill="#f6f2e8"/><g fill="none" stroke="#176b63" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>\n`);
}
console.log(`Created ${Object.keys(symbols).length} item icons.`);
