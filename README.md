## Obsidian Embedded Note Titles Plugin

This plugin embeds the note title at the top of each note in both preview and edit mode. This plugin does not modify notes, and the title is not a part of the document itself.

<img src="https://raw.githubusercontent.com/mgmeyers/obsidian-embedded-note-titles/main/screenshots/example01.gif" alt="Example output of plugin" />


### Note

In general, this plugin attempts to size the titles to align with the note content. Some themes may have styling that conflicts with these calculations. If you notice misalignment between the title and the note, the titles can be styles via css like so:

```css
.embedded-note-titles .markdown-preview-view > h1 {
  /* ...preview mode styles... */
}

.embedded-note-titles .is-readable-line-width.markdown-preview-view > h1 {
  /* ...preview mode styles with readable line width enabled... */
}

.embedded-note-titles .CodeMirror-scroll > h1 {
  /* ...edit mode styles... */
}

.embedded-note-titles .is-readable-line-width .CodeMirror-scroll > h1 {
  /* ...edit mode styles with readable line width enabled... */
}
```