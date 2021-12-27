import { EditorView } from "@codemirror/view";
import {
  App,
  MarkdownView,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
} from "obsidian";
import { getDailyNoteSettings } from "obsidian-daily-notes-interface";
import {
  LegacyCodemirrorHeadingsManager,
  PreviewHeadingsManager,
} from "./HeadingsManager";
import { Settings } from "./settings";
import { buildTitleDecoration, updateTitle } from "./titleDecoration";

export default class EmbeddedNoteTitlesPlugin extends Plugin {
  settings: Settings;
  isLegacyEditor: boolean;

  legacyCodemirrorHeadingsManager: LegacyCodemirrorHeadingsManager;
  previewHeadingsManager: PreviewHeadingsManager;

  observer: ResizeObserver;
  observedTitles: Map<HTMLElement, (entry: ResizeObserverEntry) => void>;

  async onload() {
    document.body.classList.add("embedded-note-titles");

    await this.loadSettings();

    this.addSettingTab(new EmbeddedNoteTitlesSettings(this.app, this));

    const getSettings = () => this.settings;

    this.app.workspace.trigger("parse-style-settings");
    this.previewHeadingsManager = new PreviewHeadingsManager(getSettings);
    this.isLegacyEditor = (this.app.vault as any).getConfig("legacyEditor");

    if (this.isLegacyEditor) {
      this.legacyCodemirrorHeadingsManager =
        new LegacyCodemirrorHeadingsManager(getSettings);
    } else {
      this.observedTitles = new Map();
      this.observer = new ResizeObserver((entries) => {
        entries.forEach((entry) => {
          if (this.observedTitles.has(entry.target as HTMLElement)) {
            this.observedTitles.get(entry.target as HTMLElement)(entry);
          }
        });
      });

      this.registerEditorExtension(buildTitleDecoration(this, getSettings));

      const notifyFileChange = (file: TFile) => {
        const markdownLeaves = this.app.workspace.getLeavesOfType("markdown");

        markdownLeaves.forEach((leaf) => {
          const view = leaf.view as MarkdownView;

          if (view.file === file) {
            ((view.editor as any).cm as EditorView).dispatch({
              effects: updateTitle.of(),
            });
          }
        });
      };

      this.registerEvent(this.app.vault.on("rename", notifyFileChange));

      this.registerEvent(
        this.app.metadataCache.on("changed", (file) => {
          const frontmatterKey = this.settings.titleMetadataField;

          if (frontmatterKey) {
            notifyFileChange(file);
          }
        })
      );
    }

    this.registerEvent(
      this.app.metadataCache.on("changed", (file) => {
        const frontmatterKey = this.settings.titleMetadataField;

        if (frontmatterKey) {
          const cache = this.app.metadataCache.getFileCache(file);

          if (cache?.frontmatter && cache.frontmatter[frontmatterKey]) {
            setTimeout(() => {
              this.legacyCodemirrorHeadingsManager?.createHeadings(this.app);
              this.previewHeadingsManager.createHeadings(this.app);
            }, 0);
          }
        }
      })
    );

    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        setTimeout(() => {
          this.legacyCodemirrorHeadingsManager?.createHeadings(this.app);
          this.previewHeadingsManager.createHeadings(this.app);
        }, 0);

        if (!this.isLegacyEditor) {
          setTimeout(() => {
            this.observedTitles.forEach((_, el) => {
              if (
                this.app.workspace
                  .getLeavesOfType("markdown")
                  .every((leaf) => !leaf.view.containerEl.find(`#${el.id}`))
              ) {
                this.unobserveTitle(el);
                el.remove();
              }
            });
          }, 100);
        }
      })
    );

    // Listen for CSS changes so we can recalculate heading styles
    this.registerEvent(
      this.app.workspace.on("css-change", () => {
        this.legacyCodemirrorHeadingsManager?.cleanup();
        this.previewHeadingsManager.cleanup();

        setTimeout(() => {
          this.legacyCodemirrorHeadingsManager?.createHeadings(this.app);
          this.previewHeadingsManager.createHeadings(this.app);
        }, 0);
      })
    );

    this.app.workspace.layoutReady
      ? this.app.workspace.trigger("layout-change")
      : this.app.workspace.onLayoutReady(() => {
          // Trigger layout-change to ensure headings are created when the app loads
          this.app.workspace.trigger("layout-change");
        });
  }

  onunload() {
    document.body.classList.remove("embedded-note-titles");

    this.legacyCodemirrorHeadingsManager?.cleanup();
    this.previewHeadingsManager.cleanup();
    this.observer.disconnect();
    this.observedTitles.forEach((_, el) => {
      el.remove();
    });
    this.observedTitles.clear();
  }

  observeTitle(el: HTMLElement, cb: (entry: ResizeObserverEntry) => void) {
    this.observedTitles.set(el, cb);
    this.observer.observe(el, {
      box: "border-box",
    });
  }

  unobserveTitle(el: HTMLElement) {
    if (this.observedTitles.has(el)) {
      this.observedTitles.delete(el);
      this.observer.unobserve(el);
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, await this.loadData());
  }

  async saveSettings() {
    if (!this.isLegacyEditor) {
      const markdownLeaves = this.app.workspace.getLeavesOfType("markdown");

      markdownLeaves.forEach((leaf) => {
        const view = leaf.view as MarkdownView;

        ((view.editor as any).cm as EditorView).dispatch({
          effects: updateTitle.of(),
        });
      });
    }

    this.legacyCodemirrorHeadingsManager?.cleanup();
    this.previewHeadingsManager.cleanup();

    setTimeout(() => {
      this.legacyCodemirrorHeadingsManager?.createHeadings(this.app);
      this.previewHeadingsManager.createHeadings(this.app);
    }, 0);

    await this.saveData(this.settings);
  }
}

class EmbeddedNoteTitlesSettings extends PluginSettingTab {
  plugin: EmbeddedNoteTitlesPlugin;

  constructor(app: App, plugin: EmbeddedNoteTitlesPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    let { containerEl } = this;

    containerEl.empty();

    new Setting(containerEl)
      .setName("Frontmatter field as title")
      .setDesc(
        "When a file contains this frontmatter field, it will be used as the embedded title"
      )
      .addText((text) => {
        text
          .setValue(this.plugin.settings.titleMetadataField || "")
          .onChange(async (value) => {
            this.plugin.settings.titleMetadataField = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Hide embedded title when level 1 heading is present")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.hideOnH1)
          .onChange(async (value) => {
            this.plugin.settings.hideOnH1 = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Hide embedded title using metadata `embedded-title: false`")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.hideOnMetadataField)
          .onChange(async (value) => {
            this.plugin.settings.hideOnMetadataField = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Daily note title format")
      .then((setting) => {
        setting.addMomentFormat((mf) => {
          setting.descEl.appendChild(
            createFragment((frag) => {
              frag.appendText(
                "This format will be used when displaying titles of daily notes."
              );
              frag.createEl("br");
              frag.appendText("For more syntax, refer to ");
              frag.createEl(
                "a",
                {
                  text: "format reference",
                  href: "https://momentjs.com/docs/#/displaying/format/",
                },
                (a) => {
                  a.setAttr("target", "_blank");
                }
              );
              frag.createEl("br");
              frag.appendText("Your current syntax looks like this: ");
              mf.setSampleEl(frag.createEl("b", { cls: "u-pop" }));
              frag.createEl("br");
            })
          );

          const dailyNoteSettings = getDailyNoteSettings();
          const defaultFormat = dailyNoteSettings.format || "YYYY-MM-DD";

          mf.setPlaceholder(defaultFormat);
          mf.setDefaultFormat(defaultFormat);

          if (this.plugin.settings.dailyNoteTitleFormat) {
            mf.setValue(this.plugin.settings.dailyNoteTitleFormat);
          }

          mf.onChange(async (value) => {
            this.plugin.settings.dailyNoteTitleFormat = value
              ? value
              : undefined;
            await this.plugin.saveSettings();
          });
        });
      });
  }
}
