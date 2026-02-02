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

        new Setting(containerEl)
            .setName('Theme')
            .setHeading();

        new Setting(containerEl)
            .setName('Theme')
            .setDesc('Visual theme for messages and achievements')
            .addDropdown((dropdown) => {
                const themes = getAvailableThemes();
                for (const theme of themes) {
                    dropdown.addOption(theme, this.formatThemeName(theme));
                }
                dropdown.setValue(this.plugin.settings.theme);
                dropdown.onChange((value) => {
                    this.plugin.settings.theme = value as ThemeName;
                    void this.plugin.saveSettings().then(() => this.plugin.updateTheme());
                });
            });

        // API section
        new Setting(containerEl)
            .setName('API key')
            .setHeading();

        new Setting(containerEl)
            .setName('Claude API key')
            .setDesc('API key for AI-powered features')
            .addText((text) =>
                text
                    .setPlaceholder('Paste your API key here')
                    .setValue(this.plugin.settings.aiApiKey)
                    .onChange((value) => {
                        this.plugin.settings.aiApiKey = value;
                        void this.plugin.saveSettings().then(() => this.plugin.updateAIConfig());
                    })
            );

        new Setting(containerEl)
            .setName('AI model')
            .setDesc('Claude model to use')
            .addDropdown((dropdown) => {
                dropdown.addOption('claude-sonnet-4-20250514', 'Claude sonnet 4');
                dropdown.addOption('claude-opus-4-20250514', 'Claude opus 4');
                dropdown.addOption('claude-3-5-sonnet-20241022', 'Claude 3.5 sonnet');
                dropdown.setValue(this.plugin.settings.aiModel);
                dropdown.onChange((value) => {
                    this.plugin.settings.aiModel = value;
                    void this.plugin.saveSettings().then(() => this.plugin.updateAIConfig());
                });
            });

        // Links
        new Setting(containerEl)
            .setName('Links')
            .setHeading();
        
        const linksEl = containerEl.createDiv();
        const linkPara = linksEl.createEl('p');
        const rlcLink = linkPara.createEl('a', { text: 'Roguelike CLI', href: 'https://www.rlc.rocks' });
        rlcLink.setAttr('target', '_blank');
        linkPara.appendText(' | ');
        const cvLink = linkPara.createEl('a', { text: 'Creative ventures', href: 'https://www.cv.rocks' });
        cvLink.setAttr('target', '_blank');
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
