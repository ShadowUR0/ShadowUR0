const here = import.meta.url;
const parts = ['renderer.chunk01.txt','renderer.chunk02.txt','renderer.chunk03.txt','renderer.chunk04.txt'];
let source = (await Promise.all(parts.map(async (part) => {
  const response = await fetch(new URL(part, here));
  if (!response.ok) throw new Error(`Failed to load ${part}: ${response.status}`);
  return response.text();
}))).join('');
const rewrites = new Map([
  ['../sim/rng.js', new URL('../sim/rng.js', here).href],
  ['../sim/content.js', new URL('../sim/content.js', here).href],
  ['../sim/sim.js', new URL('../sim/sim.js', here).href],
  ['./vfx.js', new URL('./vfx.js', here).href],
  ['./avatar.js', new URL('./avatar.js', here).href],
  ['./environment.js', new URL('./environment.js', here).href],
  ['three/addons/utils/BufferGeometryUtils.js', 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/utils/BufferGeometryUtils.js'],
  ['three', 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js'],
]);
for (const [specifier, absolute] of rewrites) {
  source = source.replaceAll(`'${specifier}'`, JSON.stringify(absolute)).replaceAll(`"${specifier}"`, JSON.stringify(absolute));
}
const blobUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
const module = await import(blobUrl);
URL.revokeObjectURL(blobUrl);
export const Renderer = module.Renderer;
