export const SKILLS = {
    'grave-cleave': {
        id: 'grave-cleave', classId: 'reaver', slot: 'skill1', name: 'Grave Cleave', short: 'CLEAVE',
        description: 'Lunge through the front line and carve every foe around the landing point.',
        cooldown: 4, focusCost: 20, requiredLevel: 0, maxRank: 3, baseDamage: 22, damagePerRank: 6, radius: 3.4,
    },
    'chain-rend': {
        id: 'chain-rend', classId: 'reaver', slot: 'skill2', name: 'Chain Rend', short: 'CHAIN',
        description: 'Rip the nearest enemy toward you and punish it with a heavy strike.',
        cooldown: 7, focusCost: 30, requiredLevel: 1, maxRank: 3, baseDamage: 28, damagePerRank: 7, radius: 8,
    },
    'war-cry': {
        id: 'war-cry', classId: 'reaver', slot: 'skill3', name: 'Merebreaker Cry', short: 'CRY',
        description: 'Stagger nearby enemies, restore vigor, and empower your damage for a short time.',
        cooldown: 12, focusCost: 35, requiredLevel: 2, maxRank: 3, baseDamage: 10, damagePerRank: 4, radius: 4.4,
    },
    kingbreaker: {
        id: 'kingbreaker', classId: 'reaver', slot: 'ultimate', name: 'Kingbreaker', short: 'ULT',
        description: 'Spend a full focus bar on a devastating circular execution.',
        cooldown: 22, focusCost: 100, requiredLevel: 4, maxRank: 3, baseDamage: 72, damagePerRank: 16, radius: 5.2,
    },
    'frost-nova': {
        id: 'frost-nova', classId: 'vessel', slot: 'skill1', name: 'Frost Nova', short: 'NOVA',
        description: 'Burst cold around you, damaging and slowing every enemy caught inside.',
        cooldown: 5, focusCost: 20, requiredLevel: 0, maxRank: 3, baseDamage: 12, damagePerRank: 5, radius: 3.6,
    },
    'void-lance': {
        id: 'void-lance', classId: 'vessel', slot: 'skill2', name: 'Void Lance', short: 'LANCE',
        description: 'Fire a piercing line of grave-light through every target in front of you.',
        cooldown: 6, focusCost: 30, requiredLevel: 1, maxRank: 3, baseDamage: 30, damagePerRank: 8, radius: 11,
    },
    'mist-step': {
        id: 'mist-step', classId: 'vessel', slot: 'skill3', name: 'Mist Step', short: 'BLINK',
        description: 'Blink through danger, gain brief invulnerability, and scorch the arrival point.',
        cooldown: 9, focusCost: 30, requiredLevel: 2, maxRank: 3, baseDamage: 18, damagePerRank: 5, radius: 2.8,
    },
    eclipse: {
        id: 'eclipse', classId: 'vessel', slot: 'ultimate', name: 'Eclipse', short: 'ULT',
        description: 'Collapse the mere around you in a large slowing blast of void frost.',
        cooldown: 22, focusCost: 100, requiredLevel: 4, maxRank: 3, baseDamage: 64, damagePerRank: 15, radius: 7,
    },
};
export const CLASS_SKILLS = {
    reaver: { skill1: 'grave-cleave', skill2: 'chain-rend', skill3: 'war-cry', ultimate: 'kingbreaker' },
    vessel: { skill1: 'frost-nova', skill2: 'void-lance', skill3: 'mist-step', ultimate: 'eclipse' },
};
export function createSkillRanks(raw) {
    const clampRank = (slot) => {
        const value = Number(raw?.[slot] ?? (slot === 'skill1' ? 1 : 0));
        return Number.isFinite(value) ? Math.max(slot === 'skill1' ? 1 : 0, Math.min(3, Math.floor(value))) : (slot === 'skill1' ? 1 : 0);
    };
    return { skill1: clampRank('skill1'), skill2: clampRank('skill2'), skill3: clampRank('skill3'), ultimate: clampRank('ultimate') };
}
export function createSkillCooldowns() {
    return { skill1: 0, skill2: 0, skill3: 0, ultimate: 0 };
}
export function skillFor(classId, slot) {
    return SKILLS[CLASS_SKILLS[classId][slot]];
}
export function skillDamage(def, rank) {
    return def.baseDamage + Math.max(0, rank - 1) * def.damagePerRank;
}
