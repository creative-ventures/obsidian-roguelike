// Goal status
export type GoalStatus = 'open' | 'done' | 'blocked';

// Loot rarity
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

// Loot source
export type LootSource = 'task' | 'levelup' | 'achievement' | 'boss';

// Goal configuration stored in goal note with inline fields
export interface GoalConfig {
    name: string;
    status: GoalStatus;
    deadline?: string;
    completedAt?: string;
    xp: number;
    isBoss?: boolean;
    blockedBy?: string[];
    description?: string;
    createdAt: string;
    updatedAt: string;
    notePath?: string;  // Path to the goal note
    author?: string;
}

// Loot item
export interface LootItem {
    name: string;
    rarity: Rarity;
    droppedAt: string;
    source: LootSource;
}

// Undo entry for reverting completions
export interface UndoEntry {
    path: string;
    xpLost: number;
    wasBoss: boolean;
    timestamp: string;
}

// Player profile stored in plugin data
export interface Profile {
    totalXP: number;
    level: number;
    tasksCompleted: number;
    bossesDefeated: number;
    currentStreak: number;
    longestStreak: number;
    lastCompletionDate?: string;
    achievements: string[];
    inventory: LootItem[];
    undoHistory: UndoEntry[];
    stats: {
        completedByDay: Record<string, number>;
        createdAt: string;
        deepestDepth: number;
        speedruns: number;
        nightOwlTasks: number;
        earlyBirdTasks: number;
    };
}

// Result of completing a task
export interface CompletionResult {
    xpGained: number;
    levelUp: boolean;
    oldLevel: number;
    newLevel: number;
    newAchievements: string[];
    lootDropped?: LootItem;
}

// Loot drop result
export interface LootDropResult {
    dropped: boolean;
    item?: LootItem;
}

// Achievement info
export interface AchievementInfo {
    name: string;
    desc: string;
}

// Dictionary interface for themes
export interface Dictionary {
    messages: {
        questCompleted: string;
        levelUp: string;
        newAchievement: string;
        lootDropped: string;
        bossDefeated: string;
        streakBonus: string;
        taskBlocked: string;
        taskUnblocked: string;
        deadlineSet: string;
        deadlineOverdue: string;
        welcomeBack: string;
    };
    achievements: {
        firstTask: AchievementInfo;
        tasks10: AchievementInfo;
        tasks50: AchievementInfo;
        tasks100: AchievementInfo;
        tasks500: AchievementInfo;
        tasks1000: AchievementInfo;
        boss1: AchievementInfo;
        boss5: AchievementInfo;
        boss10: AchievementInfo;
        boss25: AchievementInfo;
        streak3: AchievementInfo;
        streak7: AchievementInfo;
        streak14: AchievementInfo;
        streak30: AchievementInfo;
        depth3: AchievementInfo;
        depth5: AchievementInfo;
        depth10: AchievementInfo;
        speedrun: AchievementInfo;
        nightOwl: AchievementInfo;
        earlyBird: AchievementInfo;
    };
    loot: {
        common: string[];
        uncommon: string[];
        rare: string[];
        epic: string[];
        legendary: string[];
    };
    rarities: {
        common: string;
        uncommon: string;
        rare: string;
        epic: string;
        legendary: string;
    };
    stats: {
        level: string;
        xp: string;
        tasksCompleted: string;
        bossesDefeated: string;
        currentStreak: string;
        longestStreak: string;
        inventory: string;
    };
}

// Theme names
export type ThemeName = 
    | 'default' 
    | 'fantasy' 
    | 'space' 
    | 'starwars' 
    | 'cyberpunk' 
    | 'pirate' 
    | 'western' 
    | 'warhammer' 
    | 'ninja' 
    | 'crusader' 
    | 'darksouls';

// Plugin settings
export interface RoguelikeSettings {
    theme: ThemeName;
    aiApiKey: string;
    aiModel: string;
}

// Default settings
export const DEFAULT_SETTINGS: RoguelikeSettings = {
    theme: 'default',
    aiApiKey: '',
    aiModel: 'claude-sonnet-4-20250514',
};

// Default profile
export function createDefaultProfile(): Profile {
    return {
        totalXP: 0,
        level: 1,
        tasksCompleted: 0,
        bossesDefeated: 0,
        currentStreak: 0,
        longestStreak: 0,
        achievements: [],
        inventory: [],
        undoHistory: [],
        stats: {
            completedByDay: {},
            createdAt: new Date().toISOString(),
            deepestDepth: 0,
            speedruns: 0,
            nightOwlTasks: 0,
            earlyBirdTasks: 0,
        },
    };
}

// Goal tree node for UI
export interface GoalTreeNode {
    path: string;
    name: string;
    config: GoalConfig;
    children: GoalTreeNode[];
    depth: number;
}

// Achievement thresholds
export const ACHIEVEMENT_THRESHOLDS = {
    tasks: [1, 10, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
    bosses: [1, 5, 10, 25, 50, 100, 250, 500],
    streaks: [3, 7, 14, 30, 60, 90, 180, 365],
    depths: [3, 5, 7, 10, 15, 20],
    levels: [5, 10, 25, 50, 100, 150, 200],
    xp: [1000, 5000, 10000, 50000, 100000, 500000, 1000000],
};
