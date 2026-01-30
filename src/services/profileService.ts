import { 
    Profile, 
    CompletionResult, 
    LootItem,
    createDefaultProfile,
    ACHIEVEMENT_THRESHOLDS,
    Dictionary
} from '../types';
import { LootService } from './lootService';

// XP required for each level (cumulative)
export function xpForLevel(level: number): number {
    return Math.floor(100 * Math.pow(1.5, level - 1));
}

export function levelFromXP(xp: number): number {
    let level = 1;
    let totalRequired = 0;
    while (totalRequired + xpForLevel(level) <= xp) {
        totalRequired += xpForLevel(level);
        level++;
    }
    return level;
}

export function xpToNextLevel(xp: number): { current: number; required: number; progress: number } {
    const level = levelFromXP(xp);
    let totalForCurrentLevel = 0;
    for (let i = 1; i < level; i++) {
        totalForCurrentLevel += xpForLevel(i);
    }
    const xpInCurrentLevel = xp - totalForCurrentLevel;
    const required = xpForLevel(level);
    return {
        current: xpInCurrentLevel,
        required,
        progress: Math.floor((xpInCurrentLevel / required) * 100),
    };
}

function getAchievementId(type: string, threshold: number): string {
    return `${type}_${threshold}`;
}

export class ProfileService {
    private profile: Profile;
    private lootService: LootService;
    private saveCallback: (profile: Profile) => Promise<void>;
    
    constructor(
        profile: Profile | null,
        lootService: LootService,
        saveCallback: (profile: Profile) => Promise<void>
    ) {
        this.profile = profile || createDefaultProfile();
        this.lootService = lootService;
        this.saveCallback = saveCallback;
    }

    // Get current profile
    getProfile(): Profile {
        return this.profile;
    }

    // Update profile from loaded data
    updateProfile(profile: Profile): void {
        this.profile = {
            ...createDefaultProfile(),
            ...profile,
            stats: {
                ...createDefaultProfile().stats,
                ...profile.stats,
            },
        };
    }

    // Save profile
    async save(): Promise<void> {
        this.profile.level = levelFromXP(this.profile.totalXP);
        await this.saveCallback(this.profile);
    }

    // Complete a task and update stats
    async completeTask(
        xp: number,
        isBoss: boolean,
        depth: number,
        createdAt: string,
        theme?: string
    ): Promise<CompletionResult> {
        const oldLevel = this.profile.level;
        const today = new Date().toISOString().split('T')[0];
        const createdDate = createdAt?.split('T')[0];
        const hour = new Date().getHours();

        // Add XP
        this.profile.totalXP += xp;
        this.profile.tasksCompleted += 1;

        if (isBoss) {
            this.profile.bossesDefeated += 1;
        }

        // Track special completions
        if (createdDate && createdDate === today) {
            this.profile.stats.speedruns = (this.profile.stats.speedruns || 0) + 1;
        }
        if (hour >= 0 && hour < 6) {
            this.profile.stats.earlyBirdTasks = (this.profile.stats.earlyBirdTasks || 0) + 1;
        }
        if (hour >= 0 && hour < 5) {
            this.profile.stats.nightOwlTasks = (this.profile.stats.nightOwlTasks || 0) + 1;
        }
        this.profile.stats.deepestDepth = Math.max(this.profile.stats.deepestDepth || 0, depth);

        // Update streak
        if (this.profile.lastCompletionDate && today) {
            const lastDate = new Date(this.profile.lastCompletionDate);
            const todayDate = new Date(today);
            const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                this.profile.currentStreak += 1;
            } else if (diffDays > 1) {
                this.profile.currentStreak = 1;
            }
        } else {
            this.profile.currentStreak = 1;
        }

        this.profile.longestStreak = Math.max(this.profile.longestStreak, this.profile.currentStreak);
        if (today) {
            this.profile.lastCompletionDate = today;
        }

        // Update daily stats
        if (today) {
            this.profile.stats.completedByDay[today] = (this.profile.stats.completedByDay[today] || 0) + 1;
        }

        // Update level
        this.profile.level = levelFromXP(this.profile.totalXP);
        const levelUp = this.profile.level > oldLevel;

        // Check for new achievements
        const newAchievements = this.checkAchievements(createdDate || '', today || '', hour);

        // Roll for loot
        let lootDropped: LootItem | undefined;

        // Roll from task completion
        const taskLoot = this.lootService.rollForLoot(
            this.profile.level,
            isBoss ? 'boss' : 'task',
            theme
        );
        if (taskLoot.dropped && taskLoot.item) {
            lootDropped = taskLoot.item;
            this.profile.inventory = this.profile.inventory || [];
            this.profile.inventory.push(taskLoot.item);
        }

        // Additional roll on level up
        if (levelUp) {
            const levelLoot = this.lootService.rollForLoot(this.profile.level, 'levelup', theme);
            if (levelLoot.dropped && levelLoot.item) {
                if (!lootDropped) {
                    lootDropped = levelLoot.item;
                }
                this.profile.inventory.push(levelLoot.item);
            }
        }

        // Additional roll on new achievements
        if (newAchievements.length > 0) {
            const achievementLoot = this.lootService.rollForLoot(this.profile.level, 'achievement', theme);
            if (achievementLoot.dropped && achievementLoot.item) {
                if (!lootDropped) {
                    lootDropped = achievementLoot.item;
                }
                this.profile.inventory.push(achievementLoot.item);
            }
        }

        await this.save();

        return {
            xpGained: xp,
            levelUp,
            oldLevel,
            newLevel: this.profile.level,
            newAchievements,
            lootDropped,
        };
    }

    // Check and unlock achievements
    private checkAchievements(createdDate: string | undefined, today: string, hour: number): string[] {
        const newAchievements: string[] = [];

        const checkAchievement = (id: string) => {
            if (!this.profile.achievements.includes(id)) {
                this.profile.achievements.push(id);
                newAchievements.push(id);
            }
        };

        // Task count achievements
        for (const threshold of ACHIEVEMENT_THRESHOLDS.tasks) {
            if (this.profile.tasksCompleted >= threshold) {
                checkAchievement(getAchievementId('tasks', threshold));
            }
        }

        // Boss achievements
        for (const threshold of ACHIEVEMENT_THRESHOLDS.bosses) {
            if (this.profile.bossesDefeated >= threshold) {
                checkAchievement(getAchievementId('bosses', threshold));
            }
        }

        // Depth achievements
        for (const threshold of ACHIEVEMENT_THRESHOLDS.depths) {
            if (this.profile.stats.deepestDepth >= threshold) {
                checkAchievement(getAchievementId('depth', threshold));
            }
        }

        // Streak achievements
        for (const threshold of ACHIEVEMENT_THRESHOLDS.streaks) {
            if (this.profile.currentStreak >= threshold) {
                checkAchievement(getAchievementId('streak', threshold));
            }
        }

        // Level achievements
        for (const threshold of ACHIEVEMENT_THRESHOLDS.levels) {
            if (this.profile.level >= threshold) {
                checkAchievement(getAchievementId('level', threshold));
            }
        }

        // XP achievements
        for (const threshold of ACHIEVEMENT_THRESHOLDS.xp) {
            if (this.profile.totalXP >= threshold) {
                checkAchievement(getAchievementId('xp', threshold));
            }
        }

        // Special achievements
        if (createdDate && createdDate === today) {
            checkAchievement('speedrun');
        }
        if (hour >= 0 && hour < 5) {
            checkAchievement('nightowl');
        }
        if (hour >= 5 && hour < 7) {
            checkAchievement('earlybird');
        }

        return newAchievements;
    }

    // Undo last completion
    async performUndo(): Promise<{ success: boolean; xpLost: number; message: string }> {
        if (!this.profile.undoHistory || this.profile.undoHistory.length === 0) {
            return { success: false, xpLost: 0, message: 'Nothing to undo' };
        }

        const entry = this.profile.undoHistory.shift()!;

        this.profile.totalXP = Math.max(0, this.profile.totalXP - entry.xpLost);
        this.profile.tasksCompleted = Math.max(0, this.profile.tasksCompleted - 1);

        if (entry.wasBoss) {
            this.profile.bossesDefeated = Math.max(0, this.profile.bossesDefeated - 1);
        }

        this.profile.level = levelFromXP(this.profile.totalXP);

        const today = new Date().toISOString().split('T')[0];
        if (today && this.profile.stats.completedByDay[today]) {
            this.profile.stats.completedByDay[today] = Math.max(0, (this.profile.stats.completedByDay[today] || 0) - 1);
        }

        await this.save();

        return {
            success: true,
            xpLost: entry.xpLost,
            message: `Undo: -${entry.xpLost} XP`,
        };
    }

    // Add undo entry
    async addUndoEntry(path: string, xpLost: number, wasBoss: boolean): Promise<void> {
        this.profile.undoHistory = this.profile.undoHistory || [];
        this.profile.undoHistory.unshift({
            path,
            xpLost,
            wasBoss,
            timestamp: new Date().toISOString(),
        });

        if (this.profile.undoHistory.length > 10) {
            this.profile.undoHistory = this.profile.undoHistory.slice(0, 10);
        }

        await this.save();
    }

    // Get achievement info
    getAchievementInfo(achievementId: string, dict: Dictionary): { name: string; desc: string } | null {
        const parts = achievementId.split('_');
        const type = parts[0] || '';
        const threshold = parseInt(parts[1] || '0');

        const keyMap: Record<string, Record<number, string>> = {
            tasks: { 1: 'firstTask', 10: 'tasks10', 50: 'tasks50', 100: 'tasks100', 500: 'tasks500', 1000: 'tasks1000' },
            bosses: { 1: 'boss1', 5: 'boss5', 10: 'boss10', 25: 'boss25' },
            streak: { 3: 'streak3', 7: 'streak7', 14: 'streak14', 30: 'streak30' },
            depth: { 3: 'depth3', 5: 'depth5', 10: 'depth10' },
        };

        // Special achievements
        if (achievementId === 'speedrun') {
            return dict.achievements.speedrun;
        }
        if (achievementId === 'nightowl') {
            return dict.achievements.nightOwl;
        }
        if (achievementId === 'earlybird') {
            return dict.achievements.earlyBird;
        }

        // Get from map
        if (type && keyMap[type] && keyMap[type][threshold]) {
            const key = keyMap[type][threshold] as keyof Dictionary['achievements'];
            return dict.achievements[key];
        }

        // Generate for achievements beyond dictionary
        if (type) {
            return {
                name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${threshold}`,
                desc: `Reach ${threshold} ${type}`,
            };
        }

        return null;
    }

    // Get next achievements to unlock
    getNextAchievements(dict: Dictionary): Array<{ id: string; info: { name: string; desc: string }; current: number; target: number }> {
        const next: Array<{ id: string; info: { name: string; desc: string }; current: number; target: number }> = [];

        // Next task achievement
        for (const threshold of ACHIEVEMENT_THRESHOLDS.tasks) {
            const id = getAchievementId('tasks', threshold);
            if (!this.profile.achievements.includes(id)) {
                const info = this.getAchievementInfo(id, dict);
                if (info) {
                    next.push({ id, info, current: this.profile.tasksCompleted, target: threshold });
                    break;
                }
            }
        }

        // Next boss achievement
        for (const threshold of ACHIEVEMENT_THRESHOLDS.bosses) {
            const id = getAchievementId('bosses', threshold);
            if (!this.profile.achievements.includes(id)) {
                const info = this.getAchievementInfo(id, dict);
                if (info) {
                    next.push({ id, info, current: this.profile.bossesDefeated, target: threshold });
                    break;
                }
            }
        }

        // Next streak achievement
        for (const threshold of ACHIEVEMENT_THRESHOLDS.streaks) {
            const id = getAchievementId('streak', threshold);
            if (!this.profile.achievements.includes(id)) {
                const info = this.getAchievementInfo(id, dict);
                if (info) {
                    next.push({ id, info, current: this.profile.currentStreak, target: threshold });
                    break;
                }
            }
        }

        return next;
    }

    // Get level progress
    getLevelProgress(): { level: number; current: number; required: number; progress: number; totalXP: number } {
        const progress = xpToNextLevel(this.profile.totalXP);
        return {
            level: this.profile.level,
            ...progress,
            totalXP: this.profile.totalXP,
        };
    }

    // Get streak info
    getStreakInfo(): { current: number; longest: number; lastDate?: string } {
        return {
            current: this.profile.currentStreak,
            longest: this.profile.longestStreak,
            lastDate: this.profile.lastCompletionDate,
        };
    }
}
