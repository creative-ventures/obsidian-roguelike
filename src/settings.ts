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
            .setName('Roguelike settings')
            .setHeading();

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
        new Setting(containerEl)
            .setName('AI settings')
            .setHeading();

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

        // Links
        new Setting(containerEl)
            .setName('Links')
            .setHeading();
        
        const linksEl = containerEl.createDiv();
        const linkPara = linksEl.createEl('p');
        const rlcLink = linkPara.createEl('a', { text: 'Roguelike CLI', href: 'https://www.rlc.rocks' });
        rlcLink.setAttr('target', '_blank');
        linkPara.appendText(' | ');
        const cvLink = linkPara.createEl('a', { text: 'Creative Ventures', href: 'https://www.cv.rocks' });
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
