import {
  EditorState,
  StateEffect,
  StateField,
  Transaction,
} from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  WidgetType,
} from "@codemirror/view";
import {
  App,
  editorViewField,
  MarkdownView,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
} from "obsidian";
import {
  LegacyCodemirrorHeadingsManager,
  PreviewHeadingsManager,
} from "./HeadingsManager";

class HeaderWidget extends WidgetType {
  heading: string;
  displayName: string;

  constructor(heading: string) {
    super();
    this.heading = heading;
  }

  ignoreEvent(_event: Event): boolean {
    return true;
  }

  toDOM() {
    return createEl(
      "h1",
      {
        text: this.heading,
        cls: "cm-line embedded-note-title embedded-note-title__edit",
      },
      (el) => {
        el.addEventListener(
          "click",
          (e) => {
            e.stopPropagation();
            e.preventDefault();
          },
          { capture: true }
        );
      }
    );
  }
}

export default class EmbeddedNoteTitlesPlugin extends Plugin {
  settings: Settings;

  legacyCodemirrorHeadingsManager: LegacyCodemirrorHeadingsManager;
  previewHeadingsManager: PreviewHeadingsManager;

  async onload() {
    await this.loadSettings();

    this.addSettingTab(new EmbeddedNoteTitlesSettings(this.app, this));

    this.app.workspace.trigger("parse-style-settings");
    this.previewHeadingsManager = new PreviewHeadingsManager();

    document.body.classList.add("embedded-note-titles");

    if ((this.app.vault as any).getConfig("legacyEditor")) {
      this.legacyCodemirrorHeadingsManager =
        new LegacyCodemirrorHeadingsManager();
    } else {
      const updateTitle = StateEffect.define<boolean>();
      const getTitleForView = (view: MarkdownView) => {
        const frontmatterKey = this.settings.titleMetadataField;

        let title = view.file?.basename;

        if (frontmatterKey && view.file) {
          const cache = this.app.metadataCache.getFileCache(view.file);

          if (cache.frontmatter[frontmatterKey]) {
            title = cache.frontmatter[frontmatterKey];
          }
        }

        return title || "";
      };

      this.registerEditorExtension([
        StateField.define<DecorationSet>({
          create: (state: EditorState) => {
            const view = state.field(editorViewField);

            return Decoration.set(
              Decoration.replace({
                block: true,
                widget: new HeaderWidget(getTitleForView(view)),
              }).range(0, 0)
            );
          },
          update: (effects: DecorationSet, tr: Transaction) => {
            for (let e of tr.effects) {
              if (e.is(updateTitle)) {
                const view = tr.state.field(editorViewField);

                return Decoration.set(
                  Decoration.replace({
                    block: true,
                    widget: new HeaderWidget(getTitleForView(view)),
                  }).range(0, 0)
                );
              }
            }

            return effects;
          },
          provide: (f) => EditorView.decorations.from(f),
        }),
      ]);

      const notifyFileChange = (file: TFile) => {
        const markdownLeaves = this.app.workspace.getLeavesOfType("markdown");

        markdownLeaves.forEach((leaf) => {
          const view = leaf.view as MarkdownView;

          if (view.file === file) {
            ((view.editor as any).cm as EditorView).dispatch({
              effects: updateTitle.of(true),
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
      this.app.workspace.on("layout-change", () => {
        setTimeout(() => {
          this.legacyCodemirrorHeadingsManager?.createHeadings(this.app);
          this.previewHeadingsManager.createHeadings(this.app);
        }, 0);
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
  }

  async loadSettings() {
    this.settings = Object.assign({}, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

interface Settings {
  titleMetadataField?: string;
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
      .setName("Curly Quotes")
      .setDesc(
        "Double and single quotes will be converted to curly quotes (“” & ‘’)"
      )
      .addText((text) => {
        text
          .setValue(this.plugin.settings.titleMetadataField || "")
          .onChange(async (value) => {
            this.plugin.settings.titleMetadataField = value;
            await this.plugin.saveSettings();
          });
      });
  }
}
