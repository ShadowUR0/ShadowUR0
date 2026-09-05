const here = import.meta.url;
const parts = ['main.chunk01.txt','main.chunk02.txt'];
let source = (await Promise.all(parts.map(async (part) => {
  const response = await fetch(new URL(part, here));
  if (!response.ok) throw new Error(`Failed to load ${part}: ${response.status}`);
  return response.text();
}))).join('');
const rewrites = new Map([
  ['./sim/sim.js', new URL('./sim/sim.js', here).href],
  ['./sim/content.js', new URL('./sim/content.js', here).href],
  ['./sim/bot.js', new URL('./sim/bot.js', here).href],
  ['./render/renderer.js', new URL('./render/renderer.js', here).href],
  ['./render/hud.js', new URL('./render/hud.js', here).href],
  ['./render/audio.js', new URL('./render/audio.js', here).href],
  ['./net/client.js', new URL('./net/client.js', here).href],
]);
for (const [specifier, absolute] of rewrites) {
  source = source.replaceAll(`'${specifier}'`, JSON.stringify(absolute)).replaceAll(`"${specifier}"`, JSON.stringify(absolute));
}
const blobUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
try {
  await import(blobUrl);
} finally {
  URL.revokeObjectURL(blobUrl);
}
