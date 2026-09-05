const here = import.meta.url;
const parts = ['sim.chunk01.txt','sim.chunk02.txt','sim.chunk03.txt'];
let source = (await Promise.all(parts.map(async (part) => {
  const response = await fetch(new URL(part, here));
  if (!response.ok) throw new Error(`Failed to load ${part}: ${response.status}`);
  return response.text();
}))).join('');
for (const specifier of ['./rng.js','./content.js','./items.js','./skills.js']) {
  const absolute = new URL(specifier, here).href;
  source = source.replaceAll(`'${specifier}'`, JSON.stringify(absolute)).replaceAll(`"${specifier}"`, JSON.stringify(absolute));
}
const blobUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
const module = await import(blobUrl);
URL.revokeObjectURL(blobUrl);
export const NULL_INPUT = module.NULL_INPUT;
export const enemyDamage = module.enemyDamage;
export const createSim = module.createSim;
export const makeSave = module.makeSave;
export const grantPocketReward = module.grantPocketReward;
export const grantBossReward = module.grantBossReward;
export const equipItem = module.equipItem;
export const upgradeSkill = module.upgradeSkill;
export const enemyAttackTiming = module.enemyAttackTiming;
export const ENEMY_MELEE_HALF_ANGLE = module.ENEMY_MELEE_HALF_ANGLE;
export const enemyMeleeThreat = module.enemyMeleeThreat;
export const respawn = module.respawn;
export const objective = module.objective;
export const step = module.step;
export const simHash = module.simHash;
export const walkable = module.walkable;
export const ZONE = module.ZONE;
export const PLAYER = module.PLAYER;
export const CLASSES = module.CLASSES;
export const BOSS = module.BOSS;
