import { App, WorkspaceLeaf, debounce, moment } from "obsidian";
import {MySettings, getDailyNoteFormat} from "./settings";

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
  livePreviewHeaderContainerSizerRef: RefSizing |null = null;
  livePreviewHeaderGutterSizerRef: RefSizing | null = null;
  livePreviewHeaderSizerRef: RefSizing | null;
  outerSizerRef: RefSizing | null = null;
  spacerSizerRef: RefSizing | null = null;
  codeMirrorSizerInvalid: boolean = true;
  livePreview: boolean = false;
  settings: MySettings;

  constructor(settings: MySettings){
    this.settings = settings;
  }


  getPreviewSizerStyles() {
    const el = document.getElementsByClassName("markdown-preview-sizer");

    if (el.length) {
      this.previewSizerRef = getRefSizing(el[0] as HTMLElement);
    }
  }


  getLivePreviewSizerStyles(){
    this.codeMirrorSizerInvalid = false;
    this.codeMirrorSizerRef = {};

    // Get the settings for the heading container
    const scrollerEl = document.getElementsByClassName("cm-scroller");
    this.livePreviewHeaderContainerSizerRef = {};
    if(scrollerEl.length){
      const scroller = scrollerEl[0] as HTMLElement;
      const sizerRef = getRefSizing(scroller);
      this.livePreviewHeaderContainerSizerRef.paddingLeft = sizerRef.paddingLeft;
      this.livePreviewHeaderContainerSizerRef.paddingRight = sizerRef.paddingRight;
    }

    // Get the settings for the dummy gutter
    const rightTriangles = document.getElementsByClassName("right-triangle");
    this.livePreviewHeaderGutterSizerRef = {width: '8px'};
    const gutters = document.getElementsByClassName("cm-gutters");
    if(gutters.length){
      const gutter = gutters[0] as HTMLElement;
      const gutterSizerRef = getRefSizing(gutter);
      this.livePreviewHeaderGutterSizerRef.paddingRight = gutterSizerRef.paddingRight;
      this.livePreviewHeaderGutterSizerRef.marginLeft = gutterSizerRef.marginLeft;
    }
    
    // Get the settings for the header itself
    this.livePreviewHeaderSizerRef = {};
    const contentEl = document.getElementsByClassName("cm-content");
    if (contentEl.length) {
      const content = contentEl[0] as HTMLElement;
      const contentSizing = getRefSizing(content);
      this.livePreviewHeaderSizerRef.maxWidth = contentSizing.maxWidth;
      this.livePreviewHeaderSizerRef.marginRight = 'auto';
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
      this.applyStyles(h1Edit);
    });
  }

  applyStyles(h1Edit : HTMLElement){
      if(this.livePreview){
        applyRefStyles(h1Edit, this.livePreviewHeaderContainerSizerRef);
        applyRefStyles(h1Edit.firstChild as HTMLElement, this.livePreviewHeaderGutterSizerRef);
        applyRefStyles(h1Edit.firstChild.nextSibling as HTMLElement, this.livePreviewHeaderSizerRef);
      } else {
        applyRefStyles(h1Edit, this.codeMirrorSizerRef);
      }
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


  getStyles(){
    if(this.livePreview){
      this.getLivePreviewSizerStyles();
    } else {
      this.getCodeMirrorSizerStyles();
    }
  }

  
  createHeading(id: string, leaf: WorkspaceLeaf) {
    // CodeMirror adds margin and padding only after the editor is visible
    const mode = leaf.getViewState().state?.mode;
    if (
      this.codeMirrorSizerInvalid && mode === "source"
    ) {
      this.getStyles();

      if (!this.codeMirrorSizerInvalid) {
        this.updateCodeMirrorHeadings();
      }
    }

    if (this.headings[id]) return;

    let title = (leaf.view as any).file?.basename;

    if (!title) return;

    // Check if the title is a date and if so convert it
    if (this.settings.convertDailyNoteTitles){
      let dailyNoteFormat = getDailyNoteFormat();
      if (moment(title,dailyNoteFormat,true).isValid()){
        title = moment(title,dailyNoteFormat).format(this.settings.dateDisplayFormat);
      }
    }
    

    const editorClass = this.livePreview ? "cm-editor" : "CodeMirror-scroll";
    const lineClass = this.livePreview ? "cm-line" : "CodeMirror-lines";

    const viewContent =
      leaf.view.containerEl.getElementsByClassName(editorClass);

    const lines =
      leaf.view.containerEl.getElementsByClassName(lineClass);

    const previewContent = leaf.view.containerEl.getElementsByClassName(
      "markdown-preview-view"
    );

    if (!this.previewSizerRef) {
      this.getPreviewSizerStyles();
    }

    if (!this.codeMirrorSizerRef) {
      this.getStyles();
    }

    if (viewContent.length && previewContent.length) {
      // Create the codemirror heading
      const editEl = viewContent[0] as HTMLDivElement;
      let h1Edit: any;
      if(this.livePreview){
        // Create a flex container for the header 
        h1Edit = document.createElement("div");
        h1Edit.className="embedded-note-title-container";
        h1Edit.style.display = 'flex';
        h1Edit.style.alignItems = 'flex-start';

        // Create the title and add it to the container
        let titleEl = document.createElement("h1")
        titleEl.setText(title);
        titleEl.className="embedded-note-title";
        titleEl.style.flex = '1 1 auto'
        h1Edit.prepend(titleEl);

        //Create a dummy gutter to keep the header aligned with the content
        let gutterEl = document.createElement("div");
        gutterEl.className = "embedded-note-title-gutter";
        h1Edit.prepend(gutterEl);
      } else {
        h1Edit = document.createElement("h1");
        h1Edit.className="embedded-note-title";
        h1Edit.setText(title);
      }
            
      h1Edit.id = `${id}-edit`;
      this.applyStyles(h1Edit);

      editEl.prepend(h1Edit);

      const onResize = debounce(
        (entries: any) => {
          if (lines.length && !this.livePreview) {
            const linesEl = lines[0] as HTMLDivElement;
            const height = Math.ceil(entries[0].borderBoxSize[0].blockSize);

            linesEl.style.paddingTop = `${height}px`;
            h1Edit.style.marginBottom = `-${height}px`;
          }
        },
        20,
        true
      );

      // We need to push the content down when the pane resizes so the heading
      // doesn't cover the content
      const resizeWatcher = new (window as any).ResizeObserver(onResize);
      resizeWatcher.observe(h1Edit);

      // If we are in preview mode then create the preview heading
      if (mode === "preview"){
        // Create the preview heading
        // Some elements in previewEL may be embedded elements - we have to 
        // weed these out.
        let previewEl : HTMLDivElement;
        for(let i=0;i < previewContent.length; i++){
          previewEl = previewContent[i] as HTMLDivElement;
          if (previewEl.parentNode && previewEl.parentElement.hasClass("markdown-embed-content")){
            continue;
          } else {
            break;
          }
        }

        if (previewEl){
          const h1Preview = document.createElement("h1");
          applyRefStyles(h1Preview, this.previewSizerRef);
  
          h1Preview.setText(title);
          h1Preview.className="embedded-note-title";
          h1Preview.id = `${id}-preview`;
          previewEl.prepend(h1Preview);
        } 
      }

      this.headings[id] = { leaf, resizeWatcher };
    }
  }


  // Generate a unique ID for a leaf
  getLeafId(leaf: WorkspaceLeaf) {
    const viewState = leaf.getViewState();

    if (viewState.type === "markdown") {
      return "title-" + Math.random().toString(36).substr(2, 9);
    }

    return null;
  }

  // Iterate through all leafs and generate headings if needed
  createHeadings(app: App) {
    const seen: { [k: string]: boolean } = {};
    this.livePreview = (app.vault as any).config?.livePreview ? true : false;

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
