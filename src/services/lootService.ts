import { Rarity, LootItem, LootDropResult, LootSource, Dictionary } from '../types';
import { getDictionary } from '../data/dictionaries';

// Rarity drop chances by player level
function getDropChances(level: number): { dropRate: number; rarityWeights: Record<Rarity, number> } {
    // Base drop rate decreases with level (starts at 30%, min 5%)
    const baseDropRate = Math.max(0.05, 0.30 - (level * 0.01));

    // Rarity weights shift toward rarer items at higher levels
    const legendaryWeight = Math.min(0.05, level * 0.002);
    const epicWeight = Math.min(0.10, level * 0.004);
    const rareWeight = Math.min(0.20, 0.05 + level * 0.005);
    const uncommonWeight = Math.min(0.30, 0.15 + level * 0.005);
    const commonWeight = 1 - legendaryWeight - epicWeight - rareWeight - uncommonWeight;

    return {
        dropRate: baseDropRate,
        rarityWeights: {
            common: commonWeight,
            uncommon: uncommonWeight,
            rare: rareWeight,
            epic: epicWeight,
            legendary: legendaryWeight,
        },
    };
}

// Bonus multipliers for different sources
const SOURCE_MULTIPLIERS: Record<LootSource, number> = {
    task: 1.0,
    levelup: 3.0,      // 3x chance on level up
    achievement: 2.5,  // 2.5x chance on achievement
    boss: 2.0,         // 2x chance on boss
};

// Select random rarity based on weights
function selectRarity(weights: Record<Rarity, number>): Rarity {
    const roll = Math.random();
    let cumulative = 0;

    const rarities: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    for (const rarity of rarities) {
        cumulative += weights[rarity];
        if (roll < cumulative) {
            return rarity;
        }
    }

    return 'common';
}

// Select random item from rarity pool
function selectItem(rarity: Rarity, dict: Dictionary): string {
    const pool = dict.loot[rarity];
    if (!pool || pool.length === 0) {
        return 'Mystery Item';
    }
    return pool[Math.floor(Math.random() * pool.length)] || 'Mystery Item';
}

// Get rarity symbol
export function getRaritySymbol(rarity: Rarity): string {
    switch (rarity) {
        case 'common': return '[.]';
        case 'uncommon': return '[+]';
        case 'rare': return '[*]';
        case 'epic': return '[#]';
        case 'legendary': return '[!]';
        default: return '[.]';
    }
}

// Get rarity color class for CSS
export function getRarityColorClass(rarity: Rarity): string {
    switch (rarity) {
        case 'common': return 'rlc-rarity-common';
        case 'uncommon': return 'rlc-rarity-uncommon';
        case 'rare': return 'rlc-rarity-rare';
        case 'epic': return 'rlc-rarity-epic';
        case 'legendary': return 'rlc-rarity-legendary';
        default: return 'rlc-rarity-common';
    }
}

// Rarity values for calculating inventory worth
const RARITY_VALUES: Record<Rarity, number> = {
    common: 1,
    uncommon: 5,
    rare: 25,
    epic: 100,
    legendary: 500,
};

export class LootService {
    // Roll for loot drop
    rollForLoot(
        level: number,
        source: LootSource,
        theme?: string
    ): LootDropResult {
        const dict = getDictionary(theme);
        const { dropRate, rarityWeights } = getDropChances(level);

        // Apply source multiplier
        const adjustedDropRate = Math.min(0.95, dropRate * (SOURCE_MULTIPLIERS[source] || 1.0));

        // Roll for drop
        if (Math.random() > adjustedDropRate) {
            return { dropped: false };
        }

        // Select rarity and item
        const rarity = selectRarity(rarityWeights);
        const name = selectItem(rarity, dict);

        return {
            dropped: true,
            item: {
                name,
                rarity,
                droppedAt: new Date().toISOString(),
                source,
            },
        };
    }

    // Calculate inventory value
    calculateInventoryValue(inventory: LootItem[]): number {
        if (!inventory) return 0;
        return inventory.reduce((sum, item) => sum + RARITY_VALUES[item.rarity], 0);
    }

    // Group inventory by rarity
    groupByRarity(inventory: LootItem[]): Record<Rarity, LootItem[]> {
        const grouped: Record<Rarity, LootItem[]> = {
            legendary: [],
            epic: [],
            rare: [],
            uncommon: [],
            common: [],
        };

        for (const item of inventory || []) {
            grouped[item.rarity].push(item);
        }

        return grouped;
    }

    // Get inventory statistics
    getInventoryStats(inventory: LootItem[]): {
        total: number;
        byRarity: Record<Rarity, number>;
        value: number;
        mostRecent?: LootItem;
    } {
        const byRarity: Record<Rarity, number> = {
            common: 0,
            uncommon: 0,
            rare: 0,
            epic: 0,
            legendary: 0,
        };

        for (const item of inventory || []) {
            byRarity[item.rarity]++;
        }

        const sorted = [...(inventory || [])].sort(
            (a, b) => new Date(b.droppedAt).getTime() - new Date(a.droppedAt).getTime()
        );

        return {
            total: inventory?.length || 0,
            byRarity,
            value: this.calculateInventoryValue(inventory),
            mostRecent: sorted[0],
        };
    }

    // Format loot item for display
    formatLootItem(item: LootItem, dict: Dictionary): string {
        const rarityName = dict.rarities[item.rarity];
        const symbol = getRaritySymbol(item.rarity);
        return `${symbol} [${rarityName}] ${item.name}`;
    }

    // Get drop chance info for display
    getDropChanceInfo(level: number, source: LootSource): {
        baseChance: number;
        adjustedChance: number;
        rarityChances: Record<Rarity, number>;
    } {
        const { dropRate, rarityWeights } = getDropChances(level);
        const adjustedDropRate = Math.min(0.95, dropRate * (SOURCE_MULTIPLIERS[source] || 1.0));

        return {
            baseChance: Math.round(dropRate * 100),
            adjustedChance: Math.round(adjustedDropRate * 100),
            rarityChances: {
                common: Math.round(rarityWeights.common * 100),
                uncommon: Math.round(rarityWeights.uncommon * 100),
                rare: Math.round(rarityWeights.rare * 100),
                epic: Math.round(rarityWeights.epic * 100),
                legendary: Math.round(rarityWeights.legendary * 100),
            },
        };
    }
}
