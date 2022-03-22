import { StateEffect } from "@codemirror/state";
import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import {
  App,
  CachedMetadata,
  editorViewField,
  MarkdownView,
  TFile,
} from "obsidian";
import {
  getDailyNoteSettings,
  getDateFromFile,
} from "obsidian-daily-notes-interface";
import { hideTitleField, Settings } from "./settings";
import EmbeddedNoteTitlesPlugin from "./main";

export const updateTitle = StateEffect.define<void>();

function shouldHide(cache: CachedMetadata, settings: Settings) {
  if (
    settings.hideOnMetadataField &&
    cache?.frontmatter &&
    cache.frontmatter[hideTitleField] === false
  ) {
    return true;
  }

  if (settings.hideOnH1 && cache?.sections) {
    if (!cache.headings) return false;

    if (
      cache.sections &&
      cache.sections[0]?.type === "heading" &&
      cache.headings &&
      cache.headings[0]?.level === 1
    ) {
      return true;
    }

    if (
      cache.sections &&
      cache.sections[0]?.type === "yaml" &&
      cache.sections[1]?.type === "heading" &&
      cache.headings[0]?.level === 1
    ) {
      return true;
    }
  }

  return false;
}

export function getTitleForView(
  app: App,
  settings: Settings,
  view: MarkdownView
) {
  const frontmatterKey = settings.titleMetadataField;
  
  const file = view.file;
  
  const cache = app.metadataCache.getFileCache(file);
  let title = file?.basename;

  if (file && frontmatterKey) {

    if (shouldHide(cache, settings)) {
      return " ";
    }

    if (cache?.frontmatter && cache.frontmatter[frontmatterKey]) {
      return cache.frontmatter[frontmatterKey] || title || " ";
    }
  }

  if (file && settings.dailyNoteTitleFormat) {
    const date = getDateFromFile(file, "day");

    if (date) {
      return date.format(settings.dailyNoteTitleFormat);
    }
  }


  return title || " ";
}

export function getIconMeta(
  app: App,
  settings: Settings,
  view: MarkdownView
) {
  const file = view.file;
  const cache = app.metadataCache.getFileCache(file);
  if (!cache?.frontmatter?.icon) return false
  return cache.frontmatter.icon
}

export function buildTitleDecoration(
  plugin: EmbeddedNoteTitlesPlugin,
  getSettings: () => Settings
) {
  return [
    ViewPlugin.fromClass(
      class {
        header: HTMLElement;
        title: string;
        debounce: number;

        constructor(view: EditorView) {
          this.title = getTitleForView(
            plugin.app,
            getSettings(),
            view.state.field(editorViewField)
          );

          // This shouldn't happen, but just to be safe, remove any straggling titles
          view.contentDOM.parentElement.childNodes.forEach((node) => {
            if (
              node instanceof HTMLElement &&
              node.hasClass("embedded-note-title")
            ) {
              plugin.unobserveTitle(node);
              node.remove();
            }
          });

          this.header = createEl("h1", {
            text: this.title,
            cls: `cm-line embedded-note-title embedded-note-title__edit${
              this.title === " " ? " embedded-note-title__hidden" : ""
            }`,
            attr: {
              id: "title-cm6-" + Math.random().toString(36).substr(2, 9),
            },
          });

          view.contentDOM.before(this.header);

          plugin.observeTitle(this.header, (entry) => {
            if (entry.borderBoxSize[0]) {
              this.adjustGutter(entry.borderBoxSize[0].blockSize);
            } else {
              this.adjustGutter(entry.contentRect.height);
            }
          });

          this.adjustGutter(this.header.getBoundingClientRect().height);
        }

        adjustGutter(padding: number) {
          clearTimeout(this.debounce);

          this.debounce = window.setTimeout(() => {
            const dom = this.header?.closest(".markdown-source-view");

            if (!dom) return;

            let currentStyle = dom.getAttr("style");

            if (!currentStyle) {
              currentStyle = "";
            }

            if (currentStyle.contains("--embedded-note")) {
              currentStyle = currentStyle.replace(
                /--embedded-note-title-height: \d+px;/g,
                ""
              );
            }

            if (currentStyle && !currentStyle.endsWith(";")) {
              currentStyle += `;--embedded-note-title-height: ${padding}px;`;
            } else {
              currentStyle += `--embedded-note-title-height: ${padding}px;`;
            }

            dom.setAttribute("style", currentStyle);
          }, 10);
        }

        revertGutter() {
          const dom = this.header.closest(".markdown-source-view");
          let currentStyle = dom.getAttr("style");

          if (currentStyle && currentStyle.contains("--embedded-note")) {
            currentStyle = currentStyle.replace(
              /--embedded-note-title-height: \d+px;/g,
              ""
            );

            dom.setAttribute("style", currentStyle);
          }
        }

        update(viewUpdate: ViewUpdate) {
          viewUpdate.transactions.forEach((tr) => {
            for (let e of tr.effects) {
              if (e.is(updateTitle)) {
                this.title = getTitleForView(
                  plugin.app,
                  getSettings(),
                  tr.state.field(editorViewField)
                );
                this.header.setText(this.title);

                if (this.title === " ") {
                  this.header.classList.add("embedded-note-title__hidden");
                } else {
                  this.header.classList.remove("embedded-note-title__hidden");
                }
              }
            }
          });
        }

        destroy() {
          plugin.unobserveTitle(this.header);
          this.header.remove();
          this.header = null;
        }
      }
    ),
  ];
}
