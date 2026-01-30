import { App, Modal } from 'obsidian';

// Simple modal - just goal name
export class CreateGoalModal extends Modal {
    private name: string = '';
    private onSubmit: (name: string) => void;

    constructor(app: App, onSubmit: (name: string) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('rlc-modal');

        contentEl.createEl('h2', { text: 'Create goal' });

        const input = contentEl.createEl('input', {
            type: 'text',
            placeholder: 'Goal name...',
            cls: 'rlc-goal-input'
        });
        input.style.width = '100%';
        input.style.padding = '12px';
        input.style.marginBottom = '16px';
        input.style.fontSize = '16px';
        
        input.addEventListener('input', () => {
            this.name = input.value;
        });
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && this.name.trim()) {
                this.close();
                this.onSubmit(this.name.trim());
            }
            if (e.key === 'Escape') {
                this.close();
            }
        });

        setTimeout(() => input.focus(), 50);

        const btnContainer = contentEl.createDiv('rlc-modal-buttons');

        const createBtn = btnContainer.createEl('button', { text: 'Create' });
        createBtn.addClass('mod-cta');
        createBtn.onclick = () => {
            if (this.name.trim()) {
                this.close();
                this.onSubmit(this.name.trim());
            }
        };

        const cancelBtn = btnContainer.createEl('button', { text: 'Cancel' });
        cancelBtn.onclick = () => this.close();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
