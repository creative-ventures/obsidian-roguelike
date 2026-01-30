import { App, TFile, TFolder } from 'obsidian';
import { Profile, Dictionary, LootItem, Rarity, GoalStatus } from '../types';
import { xpToNextLevel } from './profileService';
import { getRaritySymbol } from './lootService';

export const WELCOME_NOTE_NAME = 'Welcome to Roguelike.md';

export class WelcomeService {
    constructor(private app: App) {}

    // Generate journal section
    async generateJournalSection(folderPath: string = ''): Promise<string> {
        const tasks = await this.collectAllTasks(folderPath);
        
        if (tasks.length === 0) {
            return `## Journal

\`\`\`
No active tasks. Use Cmd+Shift+G to create goals!
\`\`\`
`;
        }

        const now = new Date();
        const today = now.toISOString().split('T')[0] || '';

        const overdue = tasks.filter(t => t.status !== 'done' && t.deadline && t.deadline < today && t.deadline !== 'not set');
        const upcoming = tasks.filter(t => t.status !== 'done' && t.deadline && t.deadline >= today && t.deadline !== 'not set');
        const blocked = tasks.filter(t => t.status !== 'done' && t.blocker && t.blocker.length > 0);
        const open = tasks.filter(t => t.status !== 'done' && (!t.deadline || t.deadline === 'not set') && (!t.blocker || t.blocker.length === 0));
        const done = tasks.filter(t => t.status === 'done');

        let journal = `## Journal

\`\`\`
=== TASK LOG ===
`;

        if (overdue.length > 0) {
            journal += `\nOVERDUE (${overdue.length}):\n`;
            for (const t of overdue) {
                journal += `  ! ${t.isBoss ? '[BOSS] ' : ''}${t.name} (${t.deadline})\n`;
            }
        }

        if (upcoming.length > 0) {
            journal += `\nUPCOMING (${upcoming.length}):\n`;
            for (const t of upcoming.sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''))) {
                journal += `  > ${t.isBoss ? '[BOSS] ' : ''}${t.name} (${t.deadline})\n`;
            }
        }

        if (blocked.length > 0) {
            journal += `\nBLOCKED (${blocked.length}):\n`;
            for (const t of blocked) {
                journal += `  x ${t.name}\n`;
            }
        }

        if (open.length > 0) {
            journal += `\nOPEN (${open.length}):\n`;
            for (const t of open.slice(0, 10)) {
                journal += `  * ${t.isBoss ? '[BOSS] ' : ''}${t.name}\n`;
            }
            if (open.length > 10) {
                journal += `  ... and ${open.length - 10} more\n`;
            }
        }

        if (done.length > 0) {
            journal += `\nCOMPLETED (${done.length}):\n`;
            for (const t of done.slice(0, 5)) {
                journal += `  ✓ ${t.name}\n`;
            }
            if (done.length > 5) {
                journal += `  ... and ${done.length - 5} more\n`;
            }
        }

        journal += `\`\`\`
`;

        return journal;
    }

    private async collectAllTasks(folderPath: string): Promise<Array<{
        name: string;
        status: GoalStatus;
        deadline?: string;
        blocker?: string[];
        isBoss: boolean;
    }>> {
        const tasks: Array<{
            name: string;
            status: GoalStatus;
            deadline?: string;
            blocker?: string[];
            isBoss: boolean;
        }> = [];

        const rootFolder = folderPath 
            ? this.app.vault.getAbstractFileByPath(folderPath)
            : this.app.vault.getRoot();

        if (rootFolder instanceof TFolder) {
            await this.scanFolder(rootFolder, tasks);
        }

        return tasks;
    }

    private async scanFolder(folder: TFolder, tasks: Array<{
        name: string;
        status: GoalStatus;
        deadline?: string;
        blocker?: string[];
        isBoss: boolean;
    }>): Promise<void> {
        for (const child of folder.children) {
            if (child instanceof TFolder && !child.name.startsWith('.')) {
                // Find goal note
                const noteFile = child.children.find(
                    f => f instanceof TFile && f.extension === 'md'
                ) as TFile | undefined;

                if (noteFile) {
                    const content = await this.app.vault.read(noteFile);
                    if (content.includes('status::')) {
                        const fields = this.parseInlineFields(content);
                        const nameMatch = content.match(/^#\s+(.+)$/m);
                        
                        tasks.push({
                            name: (nameMatch && nameMatch[1]) || noteFile.basename,
                            status: (fields.status as GoalStatus) || 'open',
                            deadline: fields.deadline !== 'not set' ? fields.deadline : undefined,
                            blocker: fields.blocker && fields.blocker !== 'none' 
                                ? fields.blocker.match(/\[\[([^\]]+)\]\]/g)?.map(b => b.slice(2, -2))
                                : undefined,
                            isBoss: fields.boss === 'true',
                        });
                    }
                }

                await this.scanFolder(child, tasks);
            }
        }
    }

    private parseInlineFields(content: string): Record<string, string> {
        const fields: Record<string, string> = {};
        const lines = content.split('\n');
        
        for (const line of lines) {
            const match = line.match(/^([a-z-]+)::\s*(.*)$/i);
            if (match && match[1] && match[2] !== undefined) {
                fields[match[1].toLowerCase()] = match[2].trim();
            }
        }
        
        return fields;
    }

    // Generate full welcome note content
    async generateWelcomeContent(
        profile: Profile,
        dict: Dictionary,
        getAchievementInfo: (id: string, dict: Dictionary) => { name: string; desc: string } | null
    ): Promise<string> {
        const progress = xpToNextLevel(profile.totalXP);
        const progressBar = this.generateProgressBar(progress.progress);

        // Generate journal section
        const journalSection = await this.generateJournalSection();

        let content = `# Welcome to Roguelike

\`\`\`
  |
  |
  + \\
  \\.G_.*=.
   \`(#'/.\\  |
    .>' (_--.
 _=/d   ,^\\
~~ \\)-'   '
   / |   rlc
  '  '

╔═════════════════════════════╗
║    Welcome to Roguelike     ║
╚═════════════════════════════╝

Turn your tasks into a dungeon crawl.
Complete quests, earn XP, level up!
\`\`\`

---

${journalSection}

---

## Profile

level:: ${profile.level}
xp:: ${profile.totalXP}
xp-to-next:: ${progress.required - progress.current}
progress:: ${progressBar} ${progress.current}/${progress.required} (${progress.progress}%)

---

## Stats

tasks-completed:: ${profile.tasksCompleted}
bosses-defeated:: ${profile.bossesDefeated}
current-streak:: ${profile.currentStreak} days
longest-streak:: ${profile.longestStreak} days
deepest-depth:: ${profile.stats.deepestDepth}
speedruns:: ${profile.stats.speedruns}

---

## Achievements

`;

        if (profile.achievements.length === 0) {
            content += 'unlocked:: 0\n\n*Complete goals to unlock achievements!*\n';
        } else {
            content += `unlocked:: ${profile.achievements.length}\n\n`;
            for (const id of profile.achievements) {
                const info = getAchievementInfo(id, dict);
                if (info) {
                    content += `${info.name}:: ${info.desc}\n`;
                }
            }
        }

        content += '\n---\n\n## Inventory\n\n';

        if (!profile.inventory || profile.inventory.length === 0) {
            content += 'items:: 0\n\n*Complete goals to find loot!*\n';
        } else {
            content += `items:: ${profile.inventory.length}\n\n`;
            const byRarity = this.groupByRarity(profile.inventory);
            const rarityOrder: Rarity[] = ['legendary', 'epic', 'rare', 'uncommon', 'common'];
            
            for (const rarity of rarityOrder) {
                const items = byRarity[rarity];
                if (items.length === 0) continue;
                for (const item of items) {
                    content += `${getRaritySymbol(item.rarity)}:: ${item.name}\n`;
                }
            }
        }

        content += `
---

## Help

\`\`\`
=== ROGUELIKE ===

Hotkeys:
  Cmd+Shift+G       Create goal with AI
  Cmd+Shift+D       Toggle done/undone  
  Cmd+Shift+B       Toggle boss (3x XP)
  Cmd+Shift+M       Generate map
  Cmd+Shift+C       Generate chart
  Cmd+Shift+J       Update this note
  Cmd+Shift+P       Prompt (update content)
  Cmd+Shift+H       Generate header

Commands:
  Create goal (manual)    Simple goal without AI
  Create room (manual)    Subgoal without AI

Goal Format:
  status:: open
  boss:: false
  xp:: 25
  deadline:: 2026-02-15
  author:: [[Your Name]]
  blocker:: [[other task]]
  created:: 2026-01-30

XP System:
  Base task           10 XP
  Per depth level     +5 XP
  Boss multiplier     3x

Loot:
  [.] Common      ~25%
  [+] Uncommon    ~15%
  [*] Rare        ~8%
  [#] Epic        ~3%
  [!] Legendary   ~1%
\`\`\`

---

## Links

- [GitHub](https://github.com/creative-ventures/obsidian-roguelike)
- [Roguelike CLI](https://www.rlc.rocks)
- [Creative Ventures](https://www.cv.rocks)
`;

        return content;
    }

    // Update welcome note
    async updateWelcomeNote(
        profile: Profile,
        dict: Dictionary,
        getAchievementInfo: (id: string, dict: Dictionary) => { name: string; desc: string } | null
    ): Promise<string> {
        const content = await this.generateWelcomeContent(profile, dict, getAchievementInfo);
        const notePath = WELCOME_NOTE_NAME;

        const file = this.app.vault.getAbstractFileByPath(notePath);
        if (file instanceof TFile) {
            await this.app.vault.modify(file, content);
        } else {
            await this.app.vault.create(notePath, content);
        }

        return notePath;
    }

    private generateProgressBar(percent: number): string {
        const filled = Math.floor(percent / 5);
        const empty = 20 - filled;
        return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
    }

    private groupByRarity(inventory: LootItem[]): Record<Rarity, LootItem[]> {
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
}
