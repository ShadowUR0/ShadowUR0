import { NULL_INPUT, step, respawn, simHash, createSim, enemyAttackTiming, walkable, } from './sim.js';
import { ZONE, BOSS } from './content.js';
function dist(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }
function norm(x, z) {
    const l = Math.hypot(x, z);
    return l > 1e-6 ? [x / l, z / l] : [0, 0];
}
function nearestFoe(sim) {
    let best = null;
    let bd = Infinity;
    for (const e of sim.enemies) {
        if (e.state === 'dead')
            continue;
        const d = dist(e.x, e.z, sim.px, sim.pz);
        if (d < bd) {
            bd = d;
            best = e;
        }
    }
    return best;
}
function currentTarget(sim) {
    const p1 = sim.pockets.find(p => p.id === 'p1');
    const p2 = sim.pockets.find(p => p.id === 'p2');
    const p3 = sim.pockets.find(p => p.id === 'p3');
    if (p1.state !== 'cleared')
        return { x: 0, z: 21.5, interact: false };
    if (p2.state !== 'cleared')
        return { x: 0, z: 39.5, interact: false };
    if (sim.bossState !== 'dead') {
        if (sim.checkpoint !== 'barrow-door') {
            const sh = ZONE.shrines[1];
            return { x: sh.x, z: sh.z - 1, interact: true };
        }
        return { x: ZONE.bossSpawn.x, z: ZONE.bossSpawn.z - 4, interact: false };
    }
    if (sim.checkpoint !== 'ossuary-gate') {
        const sh = ZONE.shrines.find(s => s.id === 'ossuary-gate');
        return { x: sh.x, z: sh.z - 1, interact: true };
    }
    if (p3.state !== 'cleared')
        return { x: 0, z: 102, interact: false };
    return { x: 0, z: 120, interact: false };
}
function strafe(sim, fx, fz) {
    const side = Math.floor(sim.tick / 90) % 2 === 0 ? 1 : -1;
    return [fz * side, -fx * side];
}
export function botInput(sim) {
    const inp = { ...NULL_INPUT };
    if (sim.dead || sim.victory)
        return inp;
    const cls = sim.cls;
    const foe = nearestFoe(sim);
    const lineState = (e) => {
        const d = dist(e.x, e.z, sim.px, sim.pz);
        const steps = Math.max(2, Math.ceil(d / 0.8));
        for (let i = 1; i < steps; i++) {
            const x = sim.px + ((e.x - sim.px) * i) / steps;
            const z = sim.pz + ((e.z - sim.pz) * i) / steps;
            if (!walkable(x, z, 0.05)) {
                const inAnyRect = ZONE.walk.some(r => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1);
                return inAnyRect ? 'prop' : 'void';
            }
        }
        return 'clear';
    };
    const foeLine = foe && !cls.melee ? lineState(foe) : 'clear';
    const engaged = !!foe && dist(foe.x, foe.z, sim.px, sim.pz) < 12
        && (foe.state !== 'idle' || dist(foe.x, foe.z, sim.px, sim.pz) < foe.def.aggro + 1)
        && foeLine === 'clear';
    const danger = !!foe && foe.state === 'windup';
    if (sim.hp < sim.maxHp * 0.45 && sim.flasks > 0 && !danger)
        inp.flask = true;
    for (const p of sim.projs) {
        if (p.from !== 'enemy')
            continue;
        const d = dist(p.x, p.z, sim.px, sim.pz);
        if (d < 2.2) {
            const [vx, vz] = norm(p.vx, p.vz);
            const toX = sim.px - p.x, toZ = sim.pz - p.z;
            const toward = vx * toX + vz * toZ > 0;
            if (toward) {
                inp.dodge = true;
                const [sx, sz] = strafe(sim, vx, vz);
                inp.mx = sx;
                inp.mz = sz;
                return inp;
            }
        }
    }
    if (engaged && foe) {
        const d = dist(foe.x, foe.z, sim.px, sim.pz);
        const [tx, tz] = norm(foe.x - sim.px, foe.z - sim.pz);
        inp.aimX = tx;
        inp.aimZ = tz;
        if (foe.state === 'windup') {
            const timing = enemyAttackTiming(foe, sim);
            if (foe.attack === 'slam') {
                if (d < BOSS.slamRadius + 0.8) {
                    if (foe.t > timing.windup - 0.35) {
                        inp.dodge = true;
                    }
                    inp.mx = -tx;
                    inp.mz = -tz;
                    return inp;
                }
            }
            else if (foe.attack === 'rush') {
                if (foe.t > timing.windup - 0.3) {
                    inp.dodge = true;
                    const [sx, sz] = strafe(sim, foe.lockX, foe.lockZ);
                    inp.mx = sx;
                    inp.mz = sz;
                    return inp;
                }
            }
            else if (foe.attack === 'strike' || foe.attack === 'swing') {
                const reach = foe.def.attackRange + (foe.attack === 'strike' ? 2.5 : 1);
                if (d < reach && foe.t > timing.windup - 0.28) {
                    inp.dodge = true;
                    const [sx, sz] = strafe(sim, tx, tz);
                    inp.mx = sx;
                    inp.mz = sz;
                    return inp;
                }
            }
        }
        if (cls.melee) {
            const want = cls.range * 0.75;
            if (d > want) {
                inp.mx = tx;
                inp.mz = tz;
            }
            else {
                const [sx, sz] = strafe(sim, tx, tz);
                inp.mx = sx * 0.4;
                inp.mz = sz * 0.4;
            }
            if (d <= cls.range + foe.def.radius - 0.1)
                inp.attack = true;
            if (sim.skillCd <= 0 && d <= cls.skillRange + 2)
                inp.skill = true;
        }
        else {
            if (foe.def.melee && d < 5.5) {
                inp.mx = -tx;
                inp.mz = -tz;
            }
            else if (d > 9.5) {
                inp.mx = tx;
                inp.mz = tz;
            }
            else {
                const [sx, sz] = strafe(sim, tx, tz);
                inp.mx = sx * 0.5;
                inp.mz = sz * 0.5;
            }
            inp.attack = true;
            let close = 0;
            for (const e of sim.enemies)
                if (e.state !== 'dead' && dist(e.x, e.z, sim.px, sim.pz) < cls.skillRange)
                    close++;
            if (sim.skillCd <= 0 && close >= 2)
                inp.skill = true;
            if (sim.skillCd <= 0 && foe.kind === 'barrow' && d < cls.skillRange)
                inp.skill = true;
        }
        return inp;
    }
    if (foe && !cls.melee && foeLine === 'prop' && foe.state !== 'idle' && dist(foe.x, foe.z, sim.px, sim.pz) < 12) {
        const [dx, dz] = norm(foe.x - sim.px, foe.z - sim.pz);
        inp.mx = dx;
        inp.mz = dz;
        if (Math.floor(sim.tick / 45) % 6 === 5) {
            const [sx, sz] = strafe(sim, dx, dz);
            inp.mx = dx + sx * 0.7;
            inp.mz = dz + sz * 0.7;
        }
        return inp;
    }
    const tgt = currentTarget(sim);
    const d = dist(tgt.x, tgt.z, sim.px, sim.pz);
    if (d > 0.6) {
        const [dx, dz] = norm(tgt.x - sim.px, tgt.z - sim.pz);
        inp.mx = dx;
        inp.mz = dz;
        if (Math.floor(sim.tick / 45) % 6 === 5) {
            const [sx, sz] = strafe(sim, dx, dz);
            inp.mx = (dx + sx * 0.7);
            inp.mz = (dz + sz * 0.7);
        }
    }
    else if (tgt.interact) {
        inp.interact = true;
    }
    return inp;
}
export function runBot(classId, seed, maxTicks = 60 * 60 * 14) {
    const sim = createSim(seed, classId);
    let deaths = 0;
    for (let i = 0; i < maxTicks; i++) {
        step(sim, botInput(sim));
        if (sim.dead) {
            deaths++;
            if (deaths > 6)
                break;
            respawn(sim);
        }
        if (sim.victory)
            break;
    }
    return { victory: sim.victory, deaths, ticks: sim.tick, finalHash: simHash(sim), souls: sim.souls, level: sim.level };
}
