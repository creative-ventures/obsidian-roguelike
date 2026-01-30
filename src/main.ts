import { Notice, Plugin, TFile, MarkdownView } from 'obsidian';
import { RoguelikeSettings, DEFAULT_SETTINGS, Profile, createDefaultProfile } from './types';
import { NoteService } from './services/noteService';
import { ProfileService } from './services/profileService';
import { LootService } from './services/lootService';
import { AIService } from './services/aiService';
import { WelcomeService, WELCOME_NOTE_NAME } from './services/welcomeService';
import { getDictionary } from './data/dictionaries';
import { 
    AIPreviewModal, 
    AIPromptModal, 
    AIContentPreviewModal, 
    AIMapPreviewModal,
    AITitlePreviewModal,
    SchemaNode 
} from './ui/aiPreviewModal';
import { CreateGoalModal } from './ui/goalModal';
import { RoguelikeSettingTab } from './settings';

interface PluginData {
    settings: RoguelikeSettings;
    profile: Profile;
}

export default class RoguelikePlugin extends Plugin {
    settings: RoguelikeSettings;
    private profile: Profile;
    private noteService: NoteService;
    private profileService: ProfileService;
    private lootService: LootService;
    private aiService: AIService;
    private welcomeService: WelcomeService;

    async onload() {
        await this.loadData_();

        // Initialize services
        this.noteService = new NoteService(this.app);
        this.lootService = new LootService();
        this.welcomeService = new WelcomeService(this.app);
        this.profileService = new ProfileService(
            this.profile,
            this.lootService,
            async (profile) => {
                this.profile = profile;
                await this.saveData_();
                try {
                    await this.updateWelcomeNote();
                } catch (e) {
                    console.error('Roguelike: Failed to update welcome note', e);
                }
            }
        );
        this.aiService = new AIService(this.settings.aiApiKey, this.settings.aiModel);

        // Register commands
        this.registerCommands();

        // Add settings tab
        this.addSettingTab(new RoguelikeSettingTab(this.app, this));

        // Initialize welcome note
        this.app.workspace.onLayoutReady(async () => {
            try {
                await this.updateWelcomeNote();
            } catch (e) {
                console.error('Roguelike: Failed to initialize welcome note', e);
            }
        });
    }

    private registerCommands() {
        // Create goal with AI - Cmd+Shift+G
        this.addCommand({
            id: 'create-goal',
            name: 'Create goal with AI',
            hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'g' }],
            callback: () => this.createGoalWithAI(),
        });

        // Create goal manually (no hotkey)
        this.addCommand({
            id: 'create-goal-manual',
            name: 'Create goal (manual)',
            callback: () => this.createGoalManual(),
        });

        // Toggle done/undone - Cmd+Shift+D
        this.addCommand({
            id: 'toggle-done',
            name: 'Toggle done/undone',
            hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'd' }],
            checkCallback: (checking) => {
                const activeFile = this.app.workspace.getActiveFile();
                if (activeFile && activeFile.extension === 'md') {
                    if (!checking) {
                        this.toggleGoalDone();
                    }
                    return true;
                }
                return false;
            },
        });

        // Toggle boss - Cmd+Shift+B
        this.addCommand({
            id: 'toggle-boss',
            name: 'Toggle boss',
            hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'b' }],
            checkCallback: (checking) => {
                const activeFile = this.app.workspace.getActiveFile();
                if (activeFile && activeFile.extension === 'md') {
                    if (!checking) {
                        this.toggleGoalBoss();
                    }
                    return true;
                }
                return false;
            },
        });

        // Generate map - Cmd+Shift+M
        this.addCommand({
            id: 'generate-map',
            name: 'Generate map',
            hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'm' }],
            checkCallback: (checking) => {
                const activeFile = this.app.workspace.getActiveFile();
                if (activeFile && activeFile.extension === 'md') {
                    if (!checking) {
                        this.generateMap();
                    }
                    return true;
                }
                return false;
            },
        });

        // Generate chart/schema - Cmd+Shift+C
        this.addCommand({
            id: 'generate-chart',
            name: 'Generate chart',
            hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'c' }],
            checkCallback: (checking) => {
                const activeFile = this.app.workspace.getActiveFile();
                if (activeFile && activeFile.extension === 'md') {
                    if (!checking) {
                        this.generateChart();
                    }
                    return true;
                }
                return false;
            },
        });

        // Journal (update welcome note) - Cmd+Shift+J
        this.addCommand({
            id: 'journal',
            name: 'Journal (update welcome note)',
            hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'j' }],
            callback: async () => {
                await this.updateWelcomeNote();
                await this.openWelcomeNote();
                new Notice('Welcome note updated!');
            },
        });

        // Prompt (update note content) - Cmd+Shift+P
        this.addCommand({
            id: 'prompt',
            name: 'Prompt (update note content)',
            hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'p' }],
            checkCallback: (checking) => {
                const activeFile = this.app.workspace.getActiveFile();
                if (activeFile && activeFile.extension === 'md') {
                    if (!checking) {
                        this.promptNoteContent();
                    }
                    return true;
                }
                return false;
            },
        });

        // Generate header - Cmd+Shift+H
        this.addCommand({
            id: 'generate-header',
            name: 'Generate header',
            hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'h' }],
            checkCallback: (checking) => {
                const activeFile = this.app.workspace.getActiveFile();
                if (activeFile && activeFile.extension === 'md') {
                    if (!checking) {
                        this.generateHeader();
                    }
                    return true;
                }
                return false;
            },
        });

        // Create room manually
        this.addCommand({
            id: 'create-room-manual',
            name: 'Create room (manual)',
            callback: () => this.createRoomManual(),
        });

        // Open welcome note
        this.addCommand({
            id: 'open-welcome',
            name: 'Open welcome note',
            callback: () => this.openWelcomeNote(),
        });
    }

    // Create goal with AI (with tree context)
    private async createGoalWithAI() {
        if (!this.aiService.isConfigured()) {
            new Notice('Please configure Claude API key in settings');
            return;
        }

        const currentPath = this.noteService.getCurrentFolderPath();

        const promptResult = await this.showPromptModal(
            'Create goal with AI',
            'Describe your goal, subtasks, deadlines, dependencies...'
        );
        if (!promptResult) return;

        // Get existing tree context
        const treeContext = await this.noteService.getGoalTreeForContext(currentPath);

        await this.generateAndCreateGoals(promptResult.prompt, currentPath, treeContext);
    }

    // Create goal manually
    private async createGoalManual() {
        const currentPath = this.noteService.getCurrentFolderPath();

        new CreateGoalModal(this.app, async (name) => {
            try {
                const { notePath } = await this.noteService.createGoalWithNote(currentPath, name);

                new Notice(`Goal "${name}" created!`);
                
                const file = this.app.vault.getAbstractFileByPath(notePath);
                if (file instanceof TFile) {
                    await this.app.workspace.getLeaf().openFile(file);
                }
            } catch (error) {
                new Notice(`Error creating goal: ${error}`);
            }
        }).open();
    }

    // Create room manually
    private async createRoomManual() {
        const activeFile = this.app.workspace.getActiveFile();
        const parentPath = activeFile?.parent?.path || '';

        new CreateGoalModal(this.app, async (name) => {
            try {
                const { notePath } = await this.noteService.createGoalWithNote(parentPath, name);

                new Notice(`Room "${name}" created!`);
                
                const file = this.app.vault.getAbstractFileByPath(notePath);
                if (file instanceof TFile) {
                    await this.app.workspace.getLeaf().openFile(file);
                }
            } catch (error) {
                new Notice(`Error creating room: ${error}`);
            }
        }).open();
    }

    // Toggle goal done/undone
    private async toggleGoalDone() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) return;

        const isGoal = await this.noteService.isGoalNote(activeFile.path);
        if (!isGoal) {
            new Notice('This is not a goal note');
            return;
        }

        try {
            const result = await this.noteService.toggleGoalStatus(activeFile.path);
            if (!result) {
                new Notice('Could not toggle goal status');
                return;
            }

            const { newStatus, config } = result;
            const dict = getDictionary(this.settings.theme);
            const depth = this.noteService.calculateDepth(activeFile.parent?.path || '');

            if (newStatus === 'done') {
                // Complete the goal
                const completionResult = await this.profileService.completeTask(
                    config.xp,
                    config.isBoss || false,
                    depth,
                    config.createdAt,
                    this.settings.theme
                );

                await this.profileService.addUndoEntry(
                    activeFile.path,
                    config.xp,
                    config.isBoss || false
                );

                const message = config.isBoss 
                    ? dict.messages.bossDefeated 
                    : dict.messages.questCompleted;
                
                new Notice(`${message}\n+${config.xp} XP`);

                if (completionResult.levelUp) {
                    new Notice(`${dict.messages.levelUp}\nLevel ${completionResult.newLevel}!`);
                }

                if (completionResult.newAchievements.length > 0) {
                    for (const achId of completionResult.newAchievements) {
                        const info = this.profileService.getAchievementInfo(achId, dict);
                        if (info) {
                            new Notice(`${dict.messages.newAchievement}\n${info.name}`);
                        }
                    }
                }

                if (completionResult.lootDropped) {
                    const rarityName = dict.rarities[completionResult.lootDropped.rarity];
                    new Notice(`${dict.messages.lootDropped}\n[${rarityName}] ${completionResult.lootDropped.name}`);
                }
            } else {
                // Undo - revert XP
                const undoResult = await this.profileService.performUndo();
                new Notice(`Goal reopened\n${undoResult.message}`);
            }

        } catch (error) {
            new Notice(`Error: ${error}`);
        }
    }

    // Toggle boss status
    private async toggleGoalBoss() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) return;

        const isGoal = await this.noteService.isGoalNote(activeFile.path);
        if (!isGoal) {
            new Notice('This is not a goal note');
            return;
        }

        try {
            const result = await this.noteService.toggleBossStatus(activeFile.path);
            if (!result) {
                new Notice('Could not toggle boss status');
                return;
            }

            const message = result.isBoss 
                ? 'Marked as BOSS (3x XP)' 
                : 'Removed BOSS status';
            new Notice(message);

        } catch (error) {
            new Notice(`Error: ${error}`);
        }
    }

    // Generate map
    private async generateMap() {
        if (!this.aiService.isConfigured()) {
            new Notice('Please configure Claude API key in settings');
            return;
        }

        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) return;

        const folderPath = activeFile.parent?.path || '';
        
        new Notice('Generating map...');

        try {
            const treeContent = await this.noteService.getGoalTreeForContext(folderPath);
            if (!treeContent) {
                new Notice('No tasks found to map');
                return;
            }

            let currentMap = await this.aiService.generateMap(treeContent);
            
            while (true) {
                const result = await this.showMapPreview(currentMap);

                if (result.action === 'cancel') {
                    return;
                }

                if (result.action === 'insert') {
                    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                    if (view) {
                        const editor = view.editor;
                        const cursor = editor.getCursor();
                        editor.replaceRange('\n```\n' + currentMap + '\n```\n', cursor);
                        new Notice('Map inserted!');
                    }
                    return;
                }

                if (result.action === 'regenerate') {
                    new Notice('Regenerating map...');
                    const extra = result.comments ? `\n\nAdditional requirements: ${result.comments}` : '';
                    currentMap = await this.aiService.generateMap(treeContent + extra);
                }
            }

        } catch (error) {
            new Notice(`Error generating map: ${error}`);
        }
    }

    // Generate chart
    private async generateChart() {
        if (!this.aiService.isConfigured()) {
            new Notice('Please configure Claude API key in settings');
            return;
        }

        const promptResult = await this.showPromptModal(
            'Generate chart',
            'Describe the diagram or chart you want to create...'
        );
        if (!promptResult) return;

        new Notice('Generating chart...');

        try {
            let currentChart = await this.aiService.generateChart(promptResult.prompt);
            
            while (true) {
                const result = await this.showMapPreview(currentChart);

                if (result.action === 'cancel') {
                    return;
                }

                if (result.action === 'insert') {
                    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                    if (view) {
                        const editor = view.editor;
                        const cursor = editor.getCursor();
                        editor.replaceRange('\n```\n' + currentChart + '\n```\n', cursor);
                        new Notice('Chart inserted!');
                    }
                    return;
                }

                if (result.action === 'regenerate') {
                    new Notice('Regenerating chart...');
                    const extra = result.comments ? `\n\nAdditional requirements: ${result.comments}` : '';
                    currentChart = await this.aiService.generateChart(promptResult.prompt + extra);
                }
            }

        } catch (error) {
            new Notice(`Error generating chart: ${error}`);
        }
    }

    // Prompt (update note content) - works with selection or whole note
    private async promptNoteContent() {
        if (!this.aiService.isConfigured()) {
            new Notice('Please configure Claude API key in settings');
            return;
        }

        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return;

        const editor = view.editor;
        const selection = editor.getSelection();
        const hasSelection = selection.length > 0;

        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) return;

        const existingContent = hasSelection ? selection : await this.app.vault.read(activeFile);
        const config = await this.noteService.parseGoalNote(activeFile.path);

        const promptResult = await this.showPromptModal(
            hasSelection ? 'Update selected text with AI' : 'Update note with AI',
            hasSelection 
                ? 'What should be changed in the selected text?'
                : config 
                    ? `What content should be added/updated for "${config.name}"?`
                    : 'What content should be added/updated?'
        );
        if (!promptResult) return;

        new Notice('Generating content...');

        try {
            const systemPrompt = hasSelection
                ? `Update/modify the following text based on user request.
User wants: ${promptResult.prompt}
Generate only the replacement text, no explanations.`
                : `Generate markdown content${config ? ` for a note titled "${config.name}"` : ''}.
The user wants: ${promptResult.prompt}
Consider the existing content and add/update accordingly.
Write concise, actionable content in markdown format.`;

            let currentContent = await this.aiService.generateContent(systemPrompt, existingContent);

            while (true) {
                const result = await this.showContentPreview(currentContent, promptResult.prompt, existingContent);

                if (result.action === 'cancel') {
                    return;
                }

                if (result.action === 'insert' && result.content) {
                    if (hasSelection) {
                        // Replace selection
                        editor.replaceSelection(result.content);
                    } else {
                        // Insert at cursor
                        const cursor = editor.getCursor();
                        editor.replaceRange(result.content, cursor);
                    }
                    new Notice('Content inserted!');
                    return;
                }

                if (result.action === 'regenerate') {
                    new Notice('Regenerating content...');
                    const extra = result.comments ? `\n\nAdditional requirements: ${result.comments}` : '';
                    currentContent = await this.aiService.generateContent(systemPrompt + extra, existingContent);
                }
            }

        } catch (error) {
            new Notice(`Error: ${error}`);
        }
    }

    // Generate header (H1 always)
    private async generateHeader() {
        if (!this.aiService.isConfigured()) {
            new Notice('Please configure Claude API key in settings');
            return;
        }

        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return;

        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) return;

        const editor = view.editor;
        const selection = editor.getSelection();
        const hasSelection = selection.length > 0;

        const contentToAnalyze = hasSelection 
            ? selection 
            : editor.getValue();

        if (!contentToAnalyze.trim()) {
            new Notice('No content to generate header from');
            return;
        }

        new Notice('Generating header...');

        try {
            let currentHeader = await this.aiService.generateTitle(contentToAnalyze, hasSelection);

            while (true) {
                const result = await this.showTitlePreview(currentHeader);

                if (result.action === 'cancel') {
                    return;
                }

                if (result.action === 'insert' && result.content) {
                    if (hasSelection) {
                        // Insert H1 above selection
                        const from = editor.getCursor('from');
                        editor.replaceRange(`# ${result.content}\n\n`, { line: from.line, ch: 0 });
                        new Notice('Header inserted!');
                    } else {
                        // Replace/insert H1 at top AND rename file
                        const content = editor.getValue();
                        const h1Match = content.match(/^#\s+.+$/m);
                        if (h1Match) {
                            const newContent = content.replace(/^#\s+.+$/m, `# ${result.content}`);
                            editor.setValue(newContent);
                        } else {
                            editor.replaceRange(`# ${result.content}\n\n`, { line: 0, ch: 0 });
                        }
                        
                        // Rename file to match header
                        const newFileName = result.content + '.md';
                        const newPath = activeFile.parent 
                            ? `${activeFile.parent.path}/${newFileName}`
                            : newFileName;
                        
                        try {
                            await this.app.fileManager.renameFile(activeFile, newPath);
                            new Notice(`Header set and file renamed to "${result.content}"`);
                        } catch {
                            new Notice('Header set! (Could not rename file)');
                        }
                    }
                    return;
                }

                if (result.action === 'regenerate') {
                    new Notice('Regenerating header...');
                    const extra = result.comments ? `. Requirements: ${result.comments}` : '';
                    currentHeader = await this.aiService.generateTitle(contentToAnalyze + extra, hasSelection);
                }
            }

        } catch (error) {
            new Notice(`Error: ${error}`);
        }
    }

    // Generate and create goals with AI preview
    private async generateAndCreateGoals(prompt: string, parentPath: string, treeContext: string) {
        new Notice('Generating goal structure...');

        let currentPrompt = prompt;
        let schema: SchemaNode | null = null;

        while (true) {
            const result = await this.aiService.generateSchema(currentPrompt, treeContext);
            if (!result.success || !result.schema) {
                new Notice(`Error: ${result.error}`);
                return;
            }

            schema = result.schema;

            const previewResult = await this.showGoalPreview(schema, currentPrompt);
            
            if (previewResult.action === 'cancel') {
                return;
            }
            
            if (previewResult.action === 'create') {
                break;
            }
            
            if (previewResult.action === 'regenerate') {
                const extra = previewResult.comments ? `\n\nAdditional requirements: ${previewResult.comments}` : '';
                currentPrompt = `${prompt}${extra}`;
                new Notice('Regenerating...');
            }
        }

        if (schema) {
            const count = await this.createGoalsFromSchema(schema, parentPath);
            new Notice(`Created ${count} goals!`);
        }
    }

    // Create goals from schema
    private async createGoalsFromSchema(schema: SchemaNode, parentPath: string): Promise<number> {
        let count = 0;

        const { notePath } = await this.noteService.createGoalWithNote(parentPath, schema.name, {
            description: schema.description,
            isBoss: schema.isBoss,
            deadline: schema.deadline,
            blockers: schema.blockers,
        });
        count++;

        if (schema.children && schema.children.length > 0) {
            const folderPath = notePath.replace(/\/[^/]+\.md$/, '');
            for (const child of schema.children) {
                if (child) {
                    count += await this.createGoalsFromSchema(child, folderPath);
                }
            }
        }

        return count;
    }

    // Show prompt modal
    private showPromptModal(title: string, placeholder: string): Promise<{ prompt: string } | null> {
        return new Promise((resolve) => {
            new AIPromptModal(this.app, title, placeholder, resolve).open();
        });
    }

    // Show goal preview modal
    private showGoalPreview(schema: SchemaNode, originalPrompt: string): Promise<{ action: string; comments?: string }> {
        return new Promise((resolve) => {
            new AIPreviewModal(this.app, schema, originalPrompt, resolve).open();
        });
    }

    // Show content preview modal
    private showContentPreview(content: string, prompt: string, existing: string): Promise<{ action: string; comments?: string; content?: string }> {
        return new Promise((resolve) => {
            new AIContentPreviewModal(this.app, content, prompt, existing, resolve).open();
        });
    }

    // Show map preview modal
    private showMapPreview(map: string): Promise<{ action: string; comments?: string }> {
        return new Promise((resolve) => {
            new AIMapPreviewModal(this.app, map, resolve).open();
        });
    }

    // Show title preview modal
    private showTitlePreview(title: string): Promise<{ action: string; comments?: string; content?: string }> {
        return new Promise((resolve) => {
            new AITitlePreviewModal(this.app, title, resolve).open();
        });
    }

    // Open welcome note
    private async openWelcomeNote() {
        const file = this.app.vault.getAbstractFileByPath(WELCOME_NOTE_NAME);
        
        if (file instanceof TFile) {
            await this.app.workspace.getLeaf().openFile(file);
        } else {
            await this.updateWelcomeNote();
            const newFile = this.app.vault.getAbstractFileByPath(WELCOME_NOTE_NAME);
            if (newFile instanceof TFile) {
                await this.app.workspace.getLeaf().openFile(newFile);
            }
        }
    }

    // Update welcome note
    private async updateWelcomeNote() {
        const dict = getDictionary(this.settings.theme);
        await this.welcomeService.updateWelcomeNote(
            this.profile,
            dict,
            (id, d) => this.profileService.getAchievementInfo(id, d)
        );
    }

    updateTheme() {
        this.updateWelcomeNote();
    }

    updateAIConfig() {
        this.aiService.updateConfig(this.settings.aiApiKey, this.settings.aiModel);
    }

    getProfile(): Profile {
        return this.profile;
    }

    async loadData_() {
        const data = await this.loadData() as Partial<PluginData> | null;
        this.settings = Object.assign({}, DEFAULT_SETTINGS, data?.settings);
        this.profile = Object.assign({}, createDefaultProfile(), data?.profile);
    }

    async saveData_() {
        const data: PluginData = {
            settings: this.settings,
            profile: this.profile,
        };
        await this.saveData(data);
    }

    async saveSettings() {
        await this.saveData_();
    }
}
