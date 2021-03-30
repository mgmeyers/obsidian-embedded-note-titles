import { App, WorkspaceLeaf } from "obsidian";
import { getMatchedCSSRules } from "./getMatchedCSSRules";

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
  const rules = getMatchedCSSRules(el).reverse();
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
function applyRefStyles(heading: HTMLElement, ref: RefSizing) {
  for (const key in ref) {
    const val = ref[key as keyof RefSizing];

    if (val) {
      heading.style.setProperty(keyMap[key], val);
    }
  }
}

export class HeadingsManager {
  headings: {
    [id: string]: {
      leaf: WorkspaceLeaf;
      resizeWatcher: ResizeObserver;
    };
  } = {};

  previewSizerRef: RefSizing | null = null;
  codeMirrorSizerRef: RefSizing | null = null;
  codeMirrorSizerInvalid: boolean = true;

  getPreviewSizerStyles() {
    const el = document.getElementsByClassName("markdown-preview-sizer");

    if (el.length) {
      this.previewSizerRef = getRefSizing(el[0] as HTMLElement);
    }
  }

  getCodeMirrorSizerStyles() {
    const sizerEl = document.getElementsByClassName("CodeMirror-sizer");
    const lineEl = document.getElementsByClassName("CodeMirror-line");

    if (sizerEl.length && lineEl.length) {
      const sizer = sizerEl[0] as HTMLElement;

      const { marginLeft, paddingRight, borderRightWidth } = sizer.style;

      // If codemirror hasn't applied styles to the div yet, let's consider it 
      // invalid so we can check it again later
      if (marginLeft !== "0px" && paddingRight !== "0px") {
        this.codeMirrorSizerInvalid = false;
      }

      const inline: RefSizing = {
        marginLeft,
        marginRight: borderRightWidth,
        paddingRight,
      };

      const sizerRef = getRefSizing(sizer);

      const line = lineEl[0] as HTMLElement;
      const lineRef = getRefSizing(line);

      // Combine inline styles with CSS styles
      this.codeMirrorSizerRef = {
        ...inline,
        ...sizerRef,
      };

      if (lineRef.paddingLeft) {
        this.codeMirrorSizerRef.paddingLeft = this.codeMirrorSizerRef
          .paddingLeft
          ? `calc(${this.codeMirrorSizerRef.paddingLeft} + ${lineRef.paddingLeft})`
          : lineRef.paddingLeft;
      }

      if (lineRef.paddingRight) {
        this.codeMirrorSizerRef.paddingRight = this.codeMirrorSizerRef
          .paddingRight
          ? `calc(${this.codeMirrorSizerRef.paddingRight} + ${lineRef.paddingRight})`
          : lineRef.paddingRight;
      }
    }
  }


  // Once the codemirror heading styles have been validated, loop through and update everything
  updateCodeMirrorHeadings() {
    Object.keys(this.headings).forEach((id) => {
      const h1Edit = document.getElementById(`${id}-edit`);
      applyRefStyles(h1Edit, this.codeMirrorSizerRef);
    });
  }

  // Clean up headings once a pane has been closed or the plugin has been disabled
  removeHeading(id: string) {
    if (!this.headings[id]) return;

    const h1Edit = document.getElementById(`${id}-edit`);
    const h1Preview = document.getElementById(`${id}-preview`);

    if (h1Edit) h1Edit.remove();
    if (h1Preview) h1Preview.remove();

    this.headings[id].resizeWatcher.disconnect();

    delete this.headings[id].resizeWatcher;
    delete this.headings[id];
  }

  createHeading(id: string, leaf: WorkspaceLeaf) {
    // CodeMirror adds margin and padding only after the editor is visible
    if (
      this.codeMirrorSizerInvalid &&
      leaf.getViewState().state?.mode === "source"
    ) {
      this.getCodeMirrorSizerStyles();

      if (!this.codeMirrorSizerInvalid) {
        this.updateCodeMirrorHeadings();
      }
    }

    if (this.headings[id]) return;

    const title = (leaf.view as any).file?.basename;

    if (!title) return;

    const viewContent = leaf.view.containerEl.getElementsByClassName(
      "CodeMirror-scroll"
    );

    const lines = leaf.view.containerEl.getElementsByClassName(
      "CodeMirror-lines"
    );

    const previewContent = leaf.view.containerEl.getElementsByClassName(
      "markdown-preview-view"
    );

    if (!this.previewSizerRef) {
      this.getPreviewSizerStyles();
    }

    if (!this.codeMirrorSizerRef) {
      this.getCodeMirrorSizerStyles();
    }

    if (viewContent.length && previewContent.length) {
      // Create the codemirror heading
      const editEl = viewContent[0] as HTMLDivElement;
      const h1Edit = document.createElement("h1");

      applyRefStyles(h1Edit, this.codeMirrorSizerRef);

      h1Edit.setText(title);
      h1Edit.id = `${id}-edit`;
      editEl.prepend(h1Edit);

      let debounceTimer = 0;

      // We need to push the content down when the pane resizes so the heading
      // doesn't cover the content
      const resizeWatcher = new (window as any).ResizeObserver(
        (entries: any) => {
          clearTimeout(debounceTimer);

          debounceTimer = window.setTimeout(() => {
            if (lines.length) {
              const linesEl = lines[0] as HTMLDivElement;
              const height = Math.ceil(entries[0].borderBoxSize[0].blockSize);

              linesEl.style.paddingTop = `${height}px`;
              h1Edit.style.marginBottom = `-${height}px`;
            }
          }, 20);
        }
      );

      resizeWatcher.observe(h1Edit);
      
      // Create the preview heading
      const previewEl = previewContent[0] as HTMLDivElement;
      const h1Preview = document.createElement("h1");

      applyRefStyles(h1Preview, this.previewSizerRef);

      h1Preview.setText(title);
      h1Preview.id = `${id}-preview`;
      previewEl.prepend(h1Preview);

      this.headings[id] = { leaf, resizeWatcher };
    }
  }

  // Generate a unique ID for a leaf
  getLeafId(leaf: WorkspaceLeaf) {
    const viewState = leaf.getViewState();

    if (viewState.type === "markdown") {
      return (
        "title-" +
        (((leaf as any).id as string) + viewState.state.file).replace(
          /^[^a-z]+|[^\w:.-]+/gi,
          ""
        )
      );
    }

    return null;
  }

  // Iterate through all leafs and generate headings if needed
  createHeadings(app: App) {
    const seen: { [k: string]: boolean } = {};

    app.workspace.iterateRootLeaves((leaf) => {
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
    this.codeMirrorSizerRef = null;

    Object.keys(this.headings).forEach((id) => {
      this.removeHeading(id);
    });
  }
}
