import { EditorState, StateEffect, StateField, Transaction } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  WidgetType,
} from "@codemirror/view";
import { editorViewField, MarkdownView, Plugin } from "obsidian";
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
  legacyCodemirrorHeadingsManager: LegacyCodemirrorHeadingsManager;
  previewHeadingsManager: PreviewHeadingsManager;

  onload() {
    this.app.workspace.trigger("parse-style-settings");
    document.body.classList.add("embedded-note-titles");

    this.previewHeadingsManager = new PreviewHeadingsManager();

    if ((this.app.vault as any).getConfig("legacyEditor")) {
      this.legacyCodemirrorHeadingsManager =
        new LegacyCodemirrorHeadingsManager();
    } else {
      const updateTitle = StateEffect.define<boolean>();

      this.registerEditorExtension([
        StateField.define<DecorationSet>({
          create(state: EditorState) {
            const view = state.field(editorViewField);
    
            return Decoration.set(
              Decoration.replace({
                block: true,
                widget: new HeaderWidget(view.file?.basename || ''),
              }).range(0, 0)
            );
          },
          update(effects: DecorationSet, tr: Transaction) {
            for (let e of tr.effects) {
              if (e.is(updateTitle)) {
                const view = tr.state.field(editorViewField);

                return Decoration.set(
                  Decoration.replace({
                    block: true,
                    widget: new HeaderWidget(view.file?.basename || ''),
                  }).range(0, 0)
                );
              }
            }

            return effects;
          },
          provide: (f) => EditorView.decorations.from(f),
        })
      ]);

      this.registerEvent(this.app.vault.on("rename", file => {
        const markdownLeaves = this.app.workspace.getLeavesOfType('markdown');

        markdownLeaves.forEach(leaf => {
          const view = (leaf.view as MarkdownView);

          if (view.file === file) {
            ((view.editor as any).cm as EditorView).dispatch({
              effects: updateTitle.of(true)
            })
          }
        })
      }))
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
}
