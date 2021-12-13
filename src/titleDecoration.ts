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
import { App, CachedMetadata, editorViewField, MarkdownView } from "obsidian";
import { hideTitleField, Settings } from "./settings";

export const updateTitle = StateEffect.define<void>();

class HeaderWidget extends WidgetType {
  heading: string;
  displayName: string;

  constructor(heading: string) {
    super();
    this.heading = heading;
  }

  ignoreEvent() {
    return true;
  }

  toDOM() {
    return createEl("h1", {
      text: this.heading,
      cls: `cm-line embedded-note-title embedded-note-title__edit${
        this.heading === "" ? " embedded-note-title__hidden" : ""
      }`,
    });
  }
}

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
      cache.headings &&
      cache.headings[0]?.level === 1 &&
      cache.headings[0]?.position.start.line === 0
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

export function getTitleForView(app: App, settings: Settings, view: MarkdownView) {
  const frontmatterKey = settings.titleMetadataField;

  let title = view.file?.basename;

  if (frontmatterKey && view.file) {
    const cache = app.metadataCache.getFileCache(view.file);

    if (shouldHide(cache, settings)) {
      return "";
    }

    if (cache?.frontmatter && cache.frontmatter[frontmatterKey]) {
      title = cache.frontmatter[frontmatterKey];
    }
  }

  return title || "";
}

export function buildTitleDecoration(app: App, getSettings: () => Settings) {
  const buildWidget = (state: EditorState) => {
    const view = state.field(editorViewField);

    return Decoration.set(
      Decoration.widget({
        block: true,
        widget: new HeaderWidget(getTitleForView(app, getSettings(), view)),
      }).range(0)
    );
  };

  return [
    StateField.define<DecorationSet>({
      create: (state: EditorState) => {
        return buildWidget(state);
      },
      update: (effects: DecorationSet, tr: Transaction) => {
        for (let e of tr.effects) {
          if (e.is(updateTitle)) {
            return buildWidget(tr.state);
          }
        }

        return effects;
      },
      provide: (f) => EditorView.decorations.from(f),
    }),
  ];
}
