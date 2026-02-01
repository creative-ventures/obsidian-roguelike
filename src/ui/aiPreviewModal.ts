import { App, Modal, MarkdownRenderer, Component } from 'obsidian';

export interface SchemaNode {
    name: string;
    isBoss?: boolean;
    description?: string;
    deadline?: string;
    blockers?: string[];
    children?: SchemaNode[];
}

export interface AIPreviewResult {
    action: 'create' | 'regenerate' | 'cancel';
    comments?: string;
    schema?: SchemaNode;
}

export interface AIContentResult {
    action: 'insert' | 'regenerate' | 'cancel';
    comments?: string;
    content?: string;
}

// Preview modal for goal tree generation
export class AIPreviewModal extends Modal {
    private schema: SchemaNode;
    private originalPrompt: string;
    private comments: string = '';
    private resolve: (result: AIPreviewResult) => void;

    constructor(
        app: App,
        schema: SchemaNode,
        originalPrompt: string,
        resolve: (result: AIPreviewResult) => void
    ) {
        super(app);
        this.schema = schema;
        this.originalPrompt = originalPrompt;
        this.resolve = resolve;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('rlc-modal', 'rlc-ai-preview-modal');

        contentEl.createEl('h2', { text: 'AI generated schema' });

        // Preview section
        const previewSection = contentEl.createDiv('rlc-preview-section');
        previewSection.createEl('h4', { text: 'Preview' });
        
        const previewContainer = previewSection.createDiv('rlc-schema-preview');
        previewContainer.createEl('pre', { 
            text: this.renderSchemaTree(this.schema, 0),
            cls: 'rlc-schema-tree'
        });

        // Stats
        const stats = this.countStats(this.schema);
        const statsEl = previewSection.createDiv('rlc-schema-stats');
        statsEl.createEl('span', { text: `${stats.total} goals` });
        statsEl.createEl('span', { text: ` | ${stats.bosses} bosses` });
        statsEl.createEl('span', { text: ` | ${stats.maxDepth} levels deep` });

        // Comments section
        const commentsSection = contentEl.createDiv('rlc-comments-section');
        commentsSection.createEl('h4', { text: 'Comments for regeneration' });
        
        const textarea = commentsSection.createEl('textarea', {
            cls: 'rlc-comments-input',
            placeholder: 'Add comments to refine the schema...'
        });
        textarea.addEventListener('input', () => {
            this.comments = textarea.value;
        });

        // Buttons - Insert/Create is default (mod-cta)
        const btnContainer = contentEl.createDiv('rlc-modal-buttons');

        const createBtn = btnContainer.createEl('button', { text: 'Create goals' });
        createBtn.addClass('mod-cta');
        createBtn.onclick = () => {
            this.close();
            this.resolve({ action: 'create', schema: this.schema });
        };

        const regenerateBtn = btnContainer.createEl('button', { text: 'Regenerate' });
        regenerateBtn.onclick = () => {
            this.close();
            this.resolve({ action: 'regenerate', comments: this.comments });
        };

        const cancelBtn = btnContainer.createEl('button', { text: 'Cancel' });
        cancelBtn.onclick = () => {
            this.close();
            this.resolve({ action: 'cancel' });
        };
    }

    private renderSchemaTree(node: SchemaNode, depth: number): string {
        const indent = '  '.repeat(depth);
        const prefix = depth === 0 ? '' : '├── ';
        
        const tags: string[] = [];
        if (node.isBoss) tags.push('BOSS');
        if (node.deadline) tags.push(node.deadline);
        
        const tagStr = tags.length > 0 ? ` [${tags.join('] [')}]` : '';
        let result = `${indent}${prefix}${node.name}${tagStr}\n`;
        
        if (node.children) {
            for (const child of node.children) {
                if (child) {
                    result += this.renderSchemaTree(child, depth + 1);
                }
            }
        }
        
        return result;
    }

    private countStats(node: SchemaNode): { total: number; bosses: number; maxDepth: number } {
        let total = 1;
        let bosses = node.isBoss ? 1 : 0;
        let maxDepth = 0;

        if (node.children) {
            for (const child of node.children) {
                if (child) {
                    const childStats = this.countStats(child);
                    total += childStats.total;
                    bosses += childStats.bosses;
                    maxDepth = Math.max(maxDepth, childStats.maxDepth + 1);
                }
            }
        }

        return { total, bosses, maxDepth };
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// Preview modal for content generation (fill note / prompt)
export class AIContentPreviewModal extends Modal {
    private content: string;
    private originalPrompt: string;
    private existingContent: string;
    private comments: string = '';
    private resolve: (result: AIContentResult) => void;
    private component: Component;

    constructor(
        app: App,
        content: string,
        originalPrompt: string,
        existingContent: string,
        resolve: (result: AIContentResult) => void
    ) {
        super(app);
        this.content = content;
        this.originalPrompt = originalPrompt;
        this.existingContent = existingContent;
        this.resolve = resolve;
        this.component = new Component();
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('rlc-modal', 'rlc-ai-content-modal');

        contentEl.createEl('h2', { text: 'AI generated content' });

        // Preview section
        const previewSection = contentEl.createDiv('rlc-preview-section');
        previewSection.createEl('h4', { text: 'Preview' });
        
        const previewContainer = previewSection.createDiv('rlc-content-preview');
        MarkdownRenderer.render(
            this.app,
            this.content,
            previewContainer,
            '',
            this.component
        );

        // Comments section
        const commentsSection = contentEl.createDiv('rlc-comments-section');
        commentsSection.createEl('h4', { text: 'Comments for regeneration' });
        
        const textarea = commentsSection.createEl('textarea', {
            cls: 'rlc-comments-input',
            placeholder: 'Add comments to refine the content...'
        });
        textarea.addEventListener('input', () => {
            this.comments = textarea.value;
        });

        // Buttons - Insert is default (mod-cta)
        const btnContainer = contentEl.createDiv('rlc-modal-buttons');

        const insertBtn = btnContainer.createEl('button', { text: 'Insert' });
        insertBtn.addClass('mod-cta');
        insertBtn.onclick = () => {
            this.close();
            this.resolve({ action: 'insert', content: this.content });
        };

        const regenerateBtn = btnContainer.createEl('button', { text: 'Regenerate' });
        regenerateBtn.onclick = () => {
            this.close();
            this.resolve({ action: 'regenerate', comments: this.comments });
        };

        const cancelBtn = btnContainer.createEl('button', { text: 'Cancel' });
        cancelBtn.onclick = () => {
            this.close();
            this.resolve({ action: 'cancel' });
        };
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
        this.component.unload();
    }
}

// Preview modal for map/chart generation
export class AIMapPreviewModal extends Modal {
    private mapContent: string;
    private comments: string = '';
    private resolve: (result: AIContentResult) => void;

    constructor(
        app: App,
        mapContent: string,
        resolve: (result: AIContentResult) => void
    ) {
        super(app);
        this.mapContent = mapContent;
        this.resolve = resolve;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('rlc-modal', 'rlc-ai-map-modal');

        contentEl.createEl('h2', { text: 'AI generated' });

        // Preview section
        const previewSection = contentEl.createDiv('rlc-preview-section');
        
        const previewContainer = previewSection.createDiv('rlc-map-preview');
        previewContainer.createEl('pre', { 
            text: this.mapContent,
            cls: 'rlc-map-content'
        });

        // Comments section
        const commentsSection = contentEl.createDiv('rlc-comments-section');
        commentsSection.createEl('h4', { text: 'Comments for regeneration' });
        
        const textarea = commentsSection.createEl('textarea', {
            cls: 'rlc-comments-input',
            placeholder: 'Add comments to refine...'
        });
        textarea.addEventListener('input', () => {
            this.comments = textarea.value;
        });

        // Buttons - Insert is default (mod-cta)
        const btnContainer = contentEl.createDiv('rlc-modal-buttons');

        const insertBtn = btnContainer.createEl('button', { text: 'Insert' });
        insertBtn.addClass('mod-cta');
        insertBtn.onclick = () => {
            this.close();
            this.resolve({ action: 'insert', content: this.mapContent });
        };

        const regenerateBtn = btnContainer.createEl('button', { text: 'Regenerate' });
        regenerateBtn.onclick = () => {
            this.close();
            this.resolve({ action: 'regenerate', comments: this.comments });
        };

        const cancelBtn = btnContainer.createEl('button', { text: 'Cancel' });
        cancelBtn.onclick = () => {
            this.close();
            this.resolve({ action: 'cancel' });
        };
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// Preview modal for title generation
export class AITitlePreviewModal extends Modal {
    private title: string;
    private comments: string = '';
    private resolve: (result: AIContentResult) => void;

    constructor(
        app: App,
        title: string,
        resolve: (result: AIContentResult) => void
    ) {
        super(app);
        this.title = title;
        this.resolve = resolve;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('rlc-modal');

        contentEl.createEl('h2', { text: 'Generated title' });

        // Preview
        const previewSection = contentEl.createDiv('rlc-preview-section');
        previewSection.createEl('h3', { text: this.title, cls: 'rlc-title-preview' });

        // Comments
        const commentsSection = contentEl.createDiv('rlc-comments-section');
        commentsSection.createEl('p', { text: 'Want something different?', cls: 'setting-item-description' });
        
        const textarea = commentsSection.createEl('textarea', {
            cls: 'rlc-comments-input rlc-comments-input-small',
            placeholder: 'Describe what you want...'
        });
        textarea.addEventListener('input', () => {
            this.comments = textarea.value;
        });

        // Buttons - Insert is default (mod-cta)
        const btnContainer = contentEl.createDiv('rlc-modal-buttons');

        const insertBtn = btnContainer.createEl('button', { text: 'Insert' });
        insertBtn.addClass('mod-cta');
        insertBtn.onclick = () => {
            this.close();
            this.resolve({ action: 'insert', content: this.title });
        };

        const regenerateBtn = btnContainer.createEl('button', { text: 'Regenerate' });
        regenerateBtn.onclick = () => {
            this.close();
            this.resolve({ action: 'regenerate', comments: this.comments });
        };

        const cancelBtn = btnContainer.createEl('button', { text: 'Cancel' });
        cancelBtn.onclick = () => {
            this.close();
            this.resolve({ action: 'cancel' });
        };
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// AI Input Modal with prompt
export class AIPromptModal extends Modal {
    private resolve: (result: { prompt: string } | null) => void;
    private prompt: string = '';
    private title: string;
    private placeholder: string;

    constructor(
        app: App, 
        title: string, 
        placeholder: string, 
        resolve: (result: { prompt: string } | null) => void
    ) {
        super(app);
        this.title = title;
        this.placeholder = placeholder;
        this.resolve = resolve;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('rlc-modal');

        contentEl.createEl('h2', { text: this.title });

        const textarea = contentEl.createEl('textarea', {
            cls: 'rlc-ai-input',
            placeholder: this.placeholder
        });
        textarea.focus();

        textarea.addEventListener('input', () => {
            this.prompt = textarea.value;
        });

        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                if (this.prompt.trim()) {
                    this.close();
                    this.resolve({ prompt: this.prompt });
                }
            }
        });

        const btnContainer = contentEl.createDiv('rlc-modal-buttons');

        const generateBtn = btnContainer.createEl('button', { text: 'Generate' });
        generateBtn.addClass('mod-cta');
        generateBtn.onclick = () => {
            if (this.prompt.trim()) {
                this.close();
                this.resolve({ prompt: this.prompt });
            }
        };

        const cancelBtn = btnContainer.createEl('button', { text: 'Cancel' });
        cancelBtn.onclick = () => {
            this.close();
            this.resolve(null);
        };
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
