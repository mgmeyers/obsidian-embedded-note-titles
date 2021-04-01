import { Plugin } from "obsidian";
import { HeadingsManager } from "./HeadingsManager";

export default class EmbeddedNoteTitlesPlugin extends Plugin {
  headingsManager: HeadingsManager;

  onload() {
    document.body.classList.add("embedded-note-titles");
    this.headingsManager = new HeadingsManager();

    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        setTimeout(() => {
          this.headingsManager.createHeadings(this.app);
        }, 0);
      })
    );

    // Listen for CSS changes so we can recalculate heading styles
    this.registerEvent(
      this.app.workspace.on("css-change", () => {
        this.headingsManager.cleanup();

        setTimeout(() => {
          this.headingsManager.createHeadings(this.app);
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
    this.headingsManager.cleanup();
  }
}
