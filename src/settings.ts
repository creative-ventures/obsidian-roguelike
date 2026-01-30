import { App, PluginSettingTab, Setting } from 'obsidian';
import type RoguelikePlugin from './main';
import { ThemeName } from './types';
import { getAvailableThemes } from './data/dictionaries';

export class RoguelikeSettingTab extends PluginSettingTab {
    plugin: RoguelikePlugin;

    constructor(app: App, plugin: RoguelikePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Roguelike Settings' });

        // Theme
        new Setting(containerEl)
            .setName('Theme')
            .setDesc('Visual theme for messages and achievements')
            .addDropdown((dropdown) => {
                const themes = getAvailableThemes();
                for (const theme of themes) {
                    dropdown.addOption(theme, this.formatThemeName(theme));
                }
                dropdown.setValue(this.plugin.settings.theme);
                dropdown.onChange(async (value) => {
                    this.plugin.settings.theme = value as ThemeName;
                    await this.plugin.saveSettings();
                    this.plugin.updateTheme();
                });
            });

        // AI Settings section
        containerEl.createEl('h3', { text: 'AI Settings' });

        new Setting(containerEl)
            .setName('Claude API key')
            .setDesc('API key for AI-powered features')
            .addText((text) =>
                text
                    .setPlaceholder('sk-ant-...')
                    .setValue(this.plugin.settings.aiApiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.aiApiKey = value;
                        await this.plugin.saveSettings();
                        this.plugin.updateAIConfig();
                    })
            );

        new Setting(containerEl)
            .setName('AI model')
            .setDesc('Claude model to use')
            .addDropdown((dropdown) => {
                dropdown.addOption('claude-sonnet-4-20250514', 'Claude Sonnet 4');
                dropdown.addOption('claude-opus-4-20250514', 'Claude Opus 4');
                dropdown.addOption('claude-3-5-sonnet-20241022', 'Claude 3.5 Sonnet');
                dropdown.setValue(this.plugin.settings.aiModel);
                dropdown.onChange(async (value) => {
                    this.plugin.settings.aiModel = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateAIConfig();
                });
            });

        // Hotkeys info
        containerEl.createEl('h3', { text: 'Hotkeys' });

        const hotkeyInfo = containerEl.createDiv('rlc-hotkey-info');
        hotkeyInfo.innerHTML = `
            <table>
                <tr><td><code>Cmd+Shift+G</code></td><td>Create goal with AI</td></tr>
                <tr><td><code>Cmd+Shift+D</code></td><td>Toggle done/undone</td></tr>
                <tr><td><code>Cmd+Shift+B</code></td><td>Toggle boss</td></tr>
                <tr><td><code>Cmd+Shift+M</code></td><td>Generate map</td></tr>
                <tr><td><code>Cmd+Shift+C</code></td><td>Generate chart</td></tr>
                <tr><td><code>Cmd+Shift+J</code></td><td>Update welcome note</td></tr>
                <tr><td><code>Cmd+Shift+P</code></td><td>Prompt (update content)</td></tr>
                <tr><td><code>Cmd+Shift+H</code></td><td>Generate header</td></tr>
            </table>
        `;

        // Links
        containerEl.createEl('h3', { text: 'Links' });
        
        const linksEl = containerEl.createDiv();
        linksEl.innerHTML = `
            <p>
                <a href="https://www.rlc.rocks" target="_blank">Roguelike CLI</a> | 
                <a href="https://www.cv.rocks" target="_blank">Creative Ventures</a>
            </p>
        `;
    }

    private formatThemeName(theme: string): string {
        const names: Record<string, string> = {
            default: 'Default',
            fantasy: 'Fantasy RPG',
            space: 'Space Opera',
            starwars: 'Star Wars',
            cyberpunk: 'Cyberpunk',
            pirate: 'Pirates',
            western: 'Wild West',
            warhammer: 'Warhammer 40K',
            ninja: 'Ninja/Samurai',
            crusader: 'Crusader',
            darksouls: 'Dark Souls',
        };
        return names[theme] || theme;
    }
}
