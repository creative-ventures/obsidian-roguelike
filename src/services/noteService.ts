import { App, TFile, TFolder } from 'obsidian';
import { GoalConfig, GoalStatus } from '../types';

// Parse inline fields from note content
export function parseInlineFields(content: string): Record<string, string> {
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

// Generate inline fields string
export function generateInlineFields(fields: Record<string, string | number | boolean | undefined>): string {
    const lines: string[] = [];
    for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) {
            lines.push(`${key}:: ${value}`);
        }
    }
    return lines.join('\n');
}

export class NoteService {
    constructor(private app: App) {}

    // Get current folder path based on active file
    getCurrentFolderPath(): string {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile) {
            const parent = activeFile.parent;
            return parent ? parent.path : '';
        }
        return '';
    }

    // Get current user name
    getCurrentUser(): string {
        // Try to get from Obsidian metadata or return default
        return 'Me';
    }

    // Create safe folder name - sentence case with spaces
    createSafeFolderName(name: string, isBoss: boolean = false): string {
        // Clean up and capitalize first letter only (sentence case)
        let safeName = name
            .trim()
            .replace(/[<>:"/\\|?*]/g, '') // Remove invalid filename chars
            .replace(/\s+/g, ' '); // Normalize spaces
        
        // Capitalize first letter
        if (safeName.length > 0) {
            safeName = safeName.charAt(0).toUpperCase() + safeName.slice(1);
        }

        if (isBoss) {
            safeName = `[BOSS] ${safeName}`;
        }

        return safeName;
    }

    // Create goal folder with note
    async createGoalWithNote(
        parentPath: string,
        name: string,
        options?: {
            deadline?: string;
            description?: string;
            isBoss?: boolean;
            xp?: number;
            blockers?: string[];
            author?: string;
        }
    ): Promise<{ folderPath: string; notePath: string }> {
        const safeName = this.createSafeFolderName(name, options?.isBoss);
        const folderPath = parentPath ? `${parentPath}/${safeName}` : safeName;

        // Create folder
        const existingFolder = this.app.vault.getAbstractFileByPath(folderPath);
        if (!existingFolder) {
            await this.app.vault.createFolder(folderPath);
        }

        // Create note
        const notePath = `${folderPath}/${safeName}.md`;
        const depth = this.calculateDepth(folderPath);
        const xp = options?.xp || this.calculateXP(depth, options?.isBoss || false);
        const now = new Date().toISOString().split('T')[0];

        const noteContent = this.generateGoalNoteContent({
            name,
            status: 'open',
            xp,
            deadline: options?.deadline,
            isBoss: options?.isBoss,
            description: options?.description,
            createdAt: now,
            blockedBy: options?.blockers,
            author: options?.author || this.getCurrentUser(),
        });

        const existingNote = this.app.vault.getAbstractFileByPath(notePath);
        if (existingNote instanceof TFile) {
            await this.app.vault.modify(existingNote, noteContent);
        } else {
            await this.app.vault.create(notePath, noteContent);
        }

        return { folderPath, notePath };
    }

    // Generate goal note content with all fields always present
    generateGoalNoteContent(config: Partial<GoalConfig> & { name: string; blockedBy?: string[]; author?: string }): string {
        const deadlineValue = config.deadline || 'not set';
        const authorValue = config.author ? `[[${config.author}]]` : 'not set';
        const blockerValue = config.blockedBy && config.blockedBy.length > 0 
            ? config.blockedBy.map(b => `[[${b}]]`).join(', ')
            : 'none';

        const fields: Record<string, string | number | boolean | undefined> = {
            status: config.status || 'open',
            boss: config.isBoss || false,
            xp: config.xp,
            deadline: deadlineValue,
            author: authorValue,
            blocker: blockerValue,
            created: typeof config.createdAt === 'string' && config.createdAt.includes('T') 
                ? config.createdAt.split('T')[0] 
                : config.createdAt,
        };

        if (config.status === 'done') {
            fields.completed = typeof config.completedAt === 'string' && config.completedAt.includes('T')
                ? config.completedAt.split('T')[0]
                : config.completedAt;
        }

        let content = `# ${config.name}\n\n${generateInlineFields(fields)}\n`;

        if (config.description) {
            content += `\n## Description\n\n${config.description}\n`;
        }

        return content;
    }

    // Parse goal config from note
    async parseGoalNote(notePath: string): Promise<GoalConfig | null> {
        const file = this.app.vault.getAbstractFileByPath(notePath);
        if (!(file instanceof TFile)) {
            return null;
        }

        try {
            const content = await this.app.vault.read(file);
            const fields = parseInlineFields(content);

            // Extract name from H1
            const nameMatch = content.match(/^#\s+(.+)$/m);
            const name = (nameMatch && nameMatch[1]) ? nameMatch[1] : file.basename;

            // Extract description
            const descMatch = content.match(/## Description\n\n([\s\S]*?)(?=\n## |$)/);
            const description = (descMatch && descMatch[1]) ? descMatch[1].trim() : undefined;

            // Extract blockers
            const blockerField = fields.blocker;
            let blockedBy: string[] | undefined;
            if (blockerField && blockerField !== 'none') {
                blockedBy = blockerField.match(/\[\[([^\]]+)\]\]/g)?.map(b => b.slice(2, -2));
            }

            // Parse deadline
            const deadline = fields.deadline && fields.deadline !== 'not set' ? fields.deadline : undefined;

            return {
                name: name || file.basename,
                status: (fields.status as GoalStatus) || 'open',
                deadline,
                completedAt: fields.completed ? `${fields.completed}T00:00:00.000Z` : undefined,
                xp: parseInt(fields.xp || '10'),
                isBoss: fields.boss === 'true',
                description: description || undefined,
                createdAt: fields.created ? `${fields.created}T00:00:00.000Z` : new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                notePath,
                blockedBy,
            };
        } catch {
            return null;
        }
    }

    // Update goal note
    async updateGoalNote(notePath: string, updates: Partial<GoalConfig>): Promise<void> {
        const file = this.app.vault.getAbstractFileByPath(notePath);
        if (!(file instanceof TFile)) {
            return;
        }

        const content = await this.app.vault.read(file);
        const config = await this.parseGoalNote(notePath);
        if (!config) return;

        const newConfig = { ...config, ...updates, updatedAt: new Date().toISOString() };
        let newContent = this.generateGoalNoteContent(newConfig);

        // Preserve schema and map sections if exist
        const schemaMatch = content.match(/## (Schema|Chart)\n\n[\s\S]*?(?=\n## |$)/);
        const mapMatch = content.match(/## Map\n\n[\s\S]*?(?=\n## |$)/);
        
        if (schemaMatch) {
            newContent += '\n' + schemaMatch[0];
        }
        if (mapMatch) {
            newContent += '\n' + mapMatch[0];
        }

        await this.app.vault.modify(file, newContent);
    }

    // Toggle goal status (done/open)
    async toggleGoalStatus(notePath: string): Promise<{ newStatus: GoalStatus; config: GoalConfig } | null> {
        const config = await this.parseGoalNote(notePath);
        if (!config) return null;

        const newStatus: GoalStatus = config.status === 'done' ? 'open' : 'done';
        const completedAt = newStatus === 'done' ? new Date().toISOString() : undefined;

        await this.updateGoalNote(notePath, {
            status: newStatus,
            completedAt,
        });

        return { newStatus, config: { ...config, status: newStatus, completedAt } };
    }

    // Toggle boss status
    async toggleBossStatus(notePath: string): Promise<{ isBoss: boolean; config: GoalConfig } | null> {
        const config = await this.parseGoalNote(notePath);
        if (!config) return null;

        const file = this.app.vault.getAbstractFileByPath(notePath);
        if (!(file instanceof TFile)) return null;

        const newIsBoss = !config.isBoss;
        const depth = this.calculateDepth(file.parent?.path || '');
        const newXP = this.calculateXP(depth, newIsBoss);

        await this.updateGoalNote(notePath, {
            isBoss: newIsBoss,
            xp: newXP,
        });

        // Rename folder if needed
        const folder = file.parent;
        if (folder) {
            const oldFolderName = folder.name;
            const baseName = oldFolderName.replace(/^\[BOSS\]\s*/i, '');
            const newFolderName = newIsBoss ? `[BOSS] ${baseName}` : baseName;

            if (oldFolderName !== newFolderName) {
                const newFolderPath = folder.parent 
                    ? `${folder.parent.path}/${newFolderName}` 
                    : newFolderName;
                
                try {
                    await this.app.fileManager.renameFile(folder, newFolderPath);
                } catch (e) {
                    console.error('Failed to rename folder:', e);
                }
            }
        }

        return { isBoss: newIsBoss, config: { ...config, isBoss: newIsBoss, xp: newXP } };
    }

    // Calculate depth from path
    calculateDepth(folderPath: string): number {
        if (!folderPath) return 0;
        return folderPath.split('/').filter(p => p.length > 0).length;
    }

    // Calculate XP based on depth
    calculateXP(depth: number, isBoss: boolean = false): number {
        const baseXP = 10;
        const depthBonus = depth * 5;
        const bossMultiplier = isBoss ? 3 : 1;
        return (baseXP + depthBonus) * bossMultiplier;
    }

    // Check if file is a goal note
    async isGoalNote(filePath: string): Promise<boolean> {
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (!(file instanceof TFile)) return false;

        const content = await this.app.vault.read(file);
        return content.includes('status::');
    }

    // Add content to note at cursor position
    async insertContentAtCursor(content: string): Promise<boolean> {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) return false;

        const view = this.app.workspace.getActiveViewOfType(
            (await import('obsidian')).MarkdownView
        );
        if (!view) return false;

        const editor = view.editor;
        const cursor = editor.getCursor();
        editor.replaceRange(content, cursor);
        return true;
    }

    // Get goal tree structure for context
    async getGoalTreeForContext(folderPath: string): Promise<string> {
        if (!folderPath) {
            // Root level - scan all folders
            const root = this.app.vault.getRoot();
            return await this.buildContextTree(root, '', 0, 3);
        }

        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        if (!(folder instanceof TFolder)) return '';

        return await this.buildContextTree(folder, '', 0, 5);
    }

    private async buildContextTree(folder: TFolder, prefix: string, depth: number, maxDepth: number): Promise<string> {
        if (depth >= maxDepth) return '';
        
        let result = '';
        const children = folder.children.filter(c => c instanceof TFolder) as TFolder[];
        
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (!child || child.name.startsWith('.')) continue;
            
            const isLast = i === children.length - 1;
            const connector = isLast ? '└── ' : '├── ';
            const nextPrefix = prefix + (isLast ? '    ' : '│   ');

            // Find goal note in folder
            const noteFile = child.children.find(
                f => f instanceof TFile && f.extension === 'md'
            ) as TFile | undefined;

            let displayName = child.name.replace(/^\[BOSS\]-/i, '');
            const tags: string[] = [];

            if (noteFile) {
                const config = await this.parseGoalNote(noteFile.path);
                if (config) {
                    displayName = config.name;
                    if (config.status === 'done') tags.push('DONE');
                    if (config.isBoss) tags.push('BOSS');
                    if (config.deadline && config.deadline !== 'not set') tags.push(config.deadline);
                }
            }

            const tagStr = tags.length > 0 ? ` [${tags.join('] [')}]` : '';
            result += `${prefix}${connector}${displayName}${tagStr}\n`;

            result += await this.buildContextTree(child, nextPrefix, depth + 1, maxDepth);
        }

        return result;
    }

    // Generate journal (tree with deadlines and blockers)
    async generateJournal(folderPath: string): Promise<string> {
        const folder = folderPath 
            ? this.app.vault.getAbstractFileByPath(folderPath)
            : this.app.vault.getRoot();
            
        if (!(folder instanceof TFolder)) return 'No folder found';

        const tasks: Array<{
            name: string;
            path: string;
            status: GoalStatus;
            deadline?: string;
            blocker?: string[];
            isBoss: boolean;
            depth: number;
        }> = [];

        await this.collectTasks(folder, tasks, 0);

        if (tasks.length === 0) {
            return 'No tasks found in this folder.';
        }

        // Sort: overdue first, then by deadline, then open, then done
        const now = new Date();
        const today = now.toISOString().split('T')[0] || '';

        const overdue = tasks.filter(t => t.status !== 'done' && t.deadline && t.deadline < today && t.deadline !== 'not set');
        const upcoming = tasks.filter(t => t.status !== 'done' && t.deadline && t.deadline >= today && t.deadline !== 'not set');
        const noDeadline = tasks.filter(t => t.status !== 'done' && (!t.deadline || t.deadline === 'not set'));
        const blocked = tasks.filter(t => t.status !== 'done' && t.blocker && t.blocker.length > 0);
        const done = tasks.filter(t => t.status === 'done');

        let journal = '';

        if (overdue.length > 0) {
            journal += '## OVERDUE\n\n';
            for (const t of overdue) {
                journal += `- ⚠️ ${t.isBoss ? '[BOSS] ' : ''}${t.name} (${t.deadline})\n`;
            }
            journal += '\n';
        }

        if (upcoming.length > 0) {
            journal += '## Upcoming\n\n';
            for (const t of upcoming.sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''))) {
                journal += `- 📅 ${t.isBoss ? '[BOSS] ' : ''}${t.name} (${t.deadline})\n`;
            }
            journal += '\n';
        }

        if (blocked.length > 0) {
            journal += '## Blocked\n\n';
            for (const t of blocked) {
                const blockers = t.blocker?.join(', ') || '';
                journal += `- 🔒 ${t.name} → blocked by: ${blockers}\n`;
            }
            journal += '\n';
        }

        if (noDeadline.length > 0) {
            journal += '## Open\n\n';
            for (const t of noDeadline.filter(x => !blocked.includes(x))) {
                journal += `- ${t.isBoss ? '⭐ [BOSS] ' : '○ '}${t.name}\n`;
            }
            journal += '\n';
        }

        if (done.length > 0) {
            journal += '## Completed\n\n';
            for (const t of done.slice(0, 10)) {
                journal += `- ✓ ${t.name}\n`;
            }
            if (done.length > 10) {
                journal += `- ... and ${done.length - 10} more\n`;
            }
        }

        return journal;
    }

    private async collectTasks(
        folder: TFolder, 
        tasks: Array<{
            name: string;
            path: string;
            status: GoalStatus;
            deadline?: string;
            blocker?: string[];
            isBoss: boolean;
            depth: number;
        }>,
        depth: number
    ): Promise<void> {
        const children = folder.children;

        for (const child of children) {
            if (child instanceof TFolder && !child.name.startsWith('.')) {
                const noteFile = child.children.find(
                    f => f instanceof TFile && f.extension === 'md'
                ) as TFile | undefined;

                if (noteFile) {
                    const config = await this.parseGoalNote(noteFile.path);
                    if (config) {
                        tasks.push({
                            name: config.name,
                            path: noteFile.path,
                            status: config.status,
                            deadline: config.deadline,
                            blocker: config.blockedBy,
                            isBoss: config.isBoss || false,
                            depth,
                        });
                    }
                }

                await this.collectTasks(child, tasks, depth + 1);
            }
        }
    }
}
