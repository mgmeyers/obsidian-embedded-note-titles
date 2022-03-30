## Obsidian Embedded Note Titles Plugin

This plugin embeds the note title at the top of each note in both preview and edit mode. This plugin does not modify notes, and the title is not a part of the document itself.

**Features:**

- The embedded titles can be styled using the Style Settings plugin
- Titles can be hidden or overridden by a file's frontmatter
- Titles can be hidden if when a level 1 heading is present

<img src="https://raw.githubusercontent.com/mgmeyers/obsidian-embedded-note-titles/main/screenshots/example01.gif" alt="Example output of plugin" />

### Note

In general, this plugin attempts to size the titles to align with the note content. Some themes may have styling that conflicts with these calculations. If you notice misalignment between the title and the note, the titles can be styled via css like so:

```css
h1.embedded-note-title {
  /* ...reading mode styles... */
}

h1.cm-line.embedded-note-title {
  /* ... live preview / edit mode styles ... */
}
```

You may also need to account for readable line length:

```css
.is-readable-line-width h1.embedded-note-title {
  /* ...reading mode styles... */
}

.is-readable-line-width h1.cm-line.embedded-note-title {
  /* ...reading mode styles... */
}
```