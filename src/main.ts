import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import {DEFAULT_SETTINGS, MySettings} from "./settings";

import { HeadingsManager } from "./HeadingsManager";

export default class EmbeddedNoteTitlesPlugin extends Plugin {
  headingsManager: HeadingsManager;
  settings: MySettings;

  async onload() {
    await this.loadSettings();
    document.body.classList.add("embedded-note-titles");
    this.headingsManager = new HeadingsManager(this.settings);

    this.registerCodeMirror((cm: CodeMirror.Editor) => {
			console.log('codemirror', cm);
      
		});

    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        this.reset();
      })
    );

    // Listen for CSS changes so we can recalculate heading styles
    this.registerEvent(
      this.app.workspace.on("css-change", () => {
        this.reset();
      })
    );

    // Add the settings tab
		this.addSettingTab(new EmbeddedTitlesSettingTab(this.app, this));

    this.app.workspace.layoutReady
      ? this.app.workspace.trigger("layout-change")
      : this.app.workspace.onLayoutReady(() => {
          // Trigger layout-change to ensure headings are created when the app loads
          this.app.workspace.trigger("layout-change");
        });
  }

  async loadSettings(){
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
		await this.saveData(this.settings);
    this.reset();
	}

  reset(){
    this.headingsManager.cleanup();
    setTimeout(() => {
      this.headingsManager.createHeadings(this.app);
    }, 0);
  }

  onunload() {
    document.body.classList.remove("embedded-note-titles");
    this.headingsManager.cleanup();
  }
}

class EmbeddedTitlesSettingTab extends PluginSettingTab {
	plugin: EmbeddedNoteTitlesPlugin;

	constructor(app: App, plugin: EmbeddedNoteTitlesPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Embedded Note Titles.'});

    new Setting(containerEl)
      .setName('Modify the display of daily note titles')
      .setDesc('If selected daily note titles will be displayed using the format below')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.convertDailyNoteTitles)
        .onChange(async (value) => {
          this.plugin.settings.convertDailyNoteTitles = value;
          await this.plugin.saveSettings();
        }));

		new Setting(containerEl)
			.setName('Daily note title display format')
			.setDesc('Daily note file names will be displayed in this format rather than the file name format')
			.addText(text => text
				.setPlaceholder('Enter the date format for daily note titles')
				.setValue(this.plugin.settings.dateDisplayFormat)
				.onChange(async (value) => {
					this.plugin.settings.dateDisplayFormat = value;
					await this.plugin.saveSettings();
				}));
	}
}