const here = import.meta.url;
const parts = ['hud.part01.txt','hud.part02.txt','hud.part03.txt','hud.part04.txt'];
let source = (await Promise.all(parts.map(async (part) => {
  const response = await fetch(new URL(part, here));
  if (!response.ok) throw new Error(`Failed to load ${part}: ${response.status}`);
  return response.text();
}))).join('');
for (const specifier of ['../sim/sim.js','../sim/content.js','../sim/items.js','../sim/skills.js']) {
  const absolute = new URL(specifier, here).href;
  source = source.replaceAll(`'${specifier}'`, JSON.stringify(absolute)).replaceAll(`"${specifier}"`, JSON.stringify(absolute));
}
const blobUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
const module = await import(blobUrl);
URL.revokeObjectURL(blobUrl);
export class Hud extends module.Hud {
  showTitle(...args) {
    super.showTitle(...args);
    document.getElementById('btn-online')?.remove();
  }
}
