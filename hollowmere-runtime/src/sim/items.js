export const ITEMS = {
    'mourning-edge': {
        id: 'mourning-edge',
        name: 'Mourning Edge',
        lore: 'A blade-chip that hums when the drowned draw near.',
        effectText: '+3 damage to attacks and skills',
        effect: { damage: 3, maxHp: 0 },
        rarity: 'worn',
    },
    'barrow-heart': {
        id: 'barrow-heart',
        name: 'Barrow Heart',
        lore: 'Cold graveglass wrapped around one stubborn ember.',
        effectText: '+20 maximum health',
        effect: { damage: 0, maxHp: 20 },
        rarity: 'hollow',
    },
    'barrow-crown': {
        id: 'barrow-crown',
        name: 'Barrow Crown',
        lore: 'Grave-iron bent into the oath of a king who would not stay buried.',
        effectText: '+8 maximum health, +2 damage to attacks and skills',
        effect: { damage: 2, maxHp: 8 },
        rarity: 'sovereign',
    },
    'drowned-idol': {
        id: 'drowned-idol',
        name: 'Drowned Idol',
        lore: 'Silt-black and heavy, it remembers a name the water forgot.',
        effectText: '+12 maximum health, +1 damage to attacks and skills',
        effect: { damage: 1, maxHp: 12 },
        rarity: 'hollow',
    },
};
export const POCKET_REWARDS = {
    p1: 'mourning-edge',
    p2: 'barrow-heart',
    p3: 'drowned-idol',
};
export const BOSS_REWARD = 'barrow-crown';
export function isItemId(value) {
    return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ITEMS, value);
}
export function createInventory(owned = [], equipped = null) {
    const validOwned = [...new Set(owned.filter(isItemId))];
    const relic = isItemId(equipped) && validOwned.includes(equipped) ? equipped : null;
    return { owned: validOwned, equipped: { relic } };
}
export function grantItem(state, id, autoEquip = false) {
    if (state.owned.includes(id))
        return { state, changed: false, equippedChanged: false };
    const shouldEquip = autoEquip && state.equipped.relic === null;
    return {
        state: {
            owned: [...state.owned, id],
            equipped: { relic: shouldEquip ? id : state.equipped.relic },
        },
        changed: true,
        equippedChanged: shouldEquip,
    };
}
export function equipOwnedItem(state, id) {
    if (!state.owned.includes(id))
        return { state, changed: false, equippedChanged: false };
    if (state.equipped.relic === id)
        return { state, changed: false, equippedChanged: false };
    return {
        state: { owned: [...state.owned], equipped: { relic: id } },
        changed: true,
        equippedChanged: true,
    };
}
export function inventoryEffect(state) {
    const relic = state.equipped.relic;
    return relic ? ITEMS[relic].effect : { damage: 0, maxHp: 0 };
}
