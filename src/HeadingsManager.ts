import { App, MarkdownView, WorkspaceLeaf } from "obsidian";

import { Settings } from "./settings";
import { getMatchedCSSRules } from "./getMatchedCSSRules";
import { getTitleForView } from "./titleDecoration";

interface RefSizing {
  width?: string;
  maxWidth?: string;
  marginLeft?: string;
  marginRight?: string;
  paddingLeft?: string;
  paddingRight?: string;
}

// Split CSS margin and padding values like `0 auto`, `10px auto 0`, etc.
function getRightLeft(val: string) {
  if (/\s/.test(val)) {
    const vals = val.split(/\s+/g);

    if (vals.length === 2 || vals.length === 3) {
      return [vals[1], vals[1]];
    }

    if (vals.length === 4) {
      return [vals[1], vals[3]];
    }
  }

  return [val, val];
}

const keyMap: { [k: string]: string } = {
  width: "width",
  maxWidth: "max-width",
  margin: "margin",
  marginLeft: "margin-left",
  marginRight: "margin-right",
  padding: "padding",
  paddingLeft: "padding-left",
  paddingRight: "padding-right",
};

// Get the relevant style values from a reference element
function getRefSizing(el: HTMLElement) {
  const rules = getMatchedCSSRules(el);
  const sizing: RefSizing = {};

  rules.forEach((r) => {
    const {
      width,
      maxWidth,
      margin,
      marginLeft,
      marginRight,
      padding,
      paddingLeft,
      paddingRight,
    } = r.style;

    if (width) {
      sizing.width = width;
    }

    if (maxWidth) {
      sizing.maxWidth = maxWidth;
    }

    if (margin) {
      const [mRight, mLeft] = getRightLeft(margin);
      sizing.marginLeft = mLeft;
      sizing.marginLeft = mRight;
    }

    if (marginLeft) sizing.marginLeft = marginLeft;
    if (marginRight) sizing.marginRight = marginRight;

    if (padding) {
      const [pRight, pLeft] = getRightLeft(padding);
      sizing.paddingLeft = pLeft;
      sizing.paddingLeft = pRight;
    }

    if (paddingLeft) sizing.paddingLeft = paddingLeft;
    if (paddingRight) sizing.paddingRight = paddingRight;
  });

  return sizing;
}

// Apply reference styles to a heading element
function applyRefStyles(heading: HTMLElement, ref: RefSizing | null) {
  if (!ref) return;

  for (const key in ref) {
    const val = ref[key as keyof RefSizing];

    if (val) {
      heading.style.setProperty(keyMap[key], val);
    }
  }
}

export class PreviewHeadingsManager {
  headings: {
    [id: string]: {
      leaf: WorkspaceLeaf;
    };
  } = {};

  previewSizerRef: RefSizing | null = null;
  getSettings: () => Settings;

  constructor(getSettings: () => Settings) {
    this.getSettings = getSettings;
  }

  getPreviewSizerStyles(doc: Document) {
    const el = doc.getElementsByClassName("markdown-preview-sizer");

    if (el.length) {
      this.previewSizerRef = getRefSizing(el[0] as HTMLElement);
    }
  }

  // Clean up headings once a pane has been closed or the plugin has been disabled
  removeHeading(id: string) {
    if (!this.headings[id]) return;

    const doc = this.headings[id].leaf.view.containerEl.ownerDocument;
    const h1Preview = doc.getElementById(`${id}-preview`);

    if (h1Preview) h1Preview.remove();

    delete this.headings[id];
  }

  createHeading(id: string, leaf: WorkspaceLeaf) {
    if (this.headings[id]) return;

    const doc = leaf.view.containerEl.ownerDocument;

    const title = getTitleForView(
      leaf.view.app,
      this.getSettings(),
      leaf.view as MarkdownView
    );

    const previewContent = leaf.view.containerEl.getElementsByClassName(
      "markdown-preview-view"
    );

    if (!this.previewSizerRef) {
      this.getPreviewSizerStyles(doc);
    }

    let previewEl: HTMLDivElement;

    for (let i = 0, len = previewContent.length; i < len; i++) {
      if (
        previewContent[i].parentElement.parentElement.hasClass("view-content")
      ) {
        previewEl = previewContent[i] as HTMLDivElement;
        break;
      }
    }

    if (previewEl) {
      // Create the preview heading
      const h1Preview = doc.createElement("h1");

      applyRefStyles(h1Preview, this.previewSizerRef);

      h1Preview.setText(title);
      h1Preview.id = `${id}-preview`;
      h1Preview.classList.add(
        "embedded-note-title",
        "embedded-note-title__preview"
      );

      if (title === "") {
        h1Preview.classList.add("embedded-note-title__hidden");
      }

      previewEl.prepend(h1Preview);

      this.headings[id] = { leaf };
    }
  }

  // Generate a unique ID for a leaf
  getLeafId(leaf: WorkspaceLeaf) {
    return "title-" + Math.random().toString(36).substring(2, 9);
  }

  // Iterate through all leafs and generate headings if needed
  createHeadings(app: App) {
    const seen: { [k: string]: boolean } = {};

    app.workspace.getLeavesOfType("markdown").forEach((leaf) => {
      const id = this.getLeafId(leaf);

      if (id) {
        this.createHeading(id, leaf);
        seen[id] = true;
      }
    });

    Object.keys(this.headings).forEach((id) => {
      if (!seen[id]) {
        this.removeHeading(id);
      }
    });
  }

  cleanup() {
    this.previewSizerRef = null;

    Object.keys(this.headings).forEach((id) => {
      this.removeHeading(id);
    });
  }
}
