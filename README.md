# Copy as Markdown

A VS Code extension that lets you browse a project tree, select files with checkboxes, and copy their contents as Markdown for sharing, documentation, or code review.

## Overview

Copy as Markdown helps you quickly turn selected source files into a clean Markdown snippet with:

- a file heading for each selected file,
- a fenced code block,
- automatic language detection,
- optional path inclusion in the output.

This is especially useful when you want to share code from multiple files in a single paste-friendly format.

## Features

- Browse workspace files in a tree view
- Select individual files or select all visible files
- Copy selected files as Markdown to the clipboard
- Preserve folder structure in the tree view
- Automatically detect language for code fences
- Refresh the tree when workspace files change

## Example output

If you select a file such as `src/app.ts`, the extension generates output like this:

```markdown
### src/app.ts

```typescript
console.log('hello');
```
```

## Installation

1. Install Node.js and npm if they are not already installed.
2. Open the extension folder in a terminal.
3. Run:

```bash
npm install
npm run compile
```

## Run locally

1. Open the project in VS Code.
2. Press `F5` to launch the Extension Development Host.
3. In the new window, open the Copy as Markdown view from the Activity Bar.
4. Select files and click the copy action.

## Package the extension

To create a `.vsix` package:

```bash
npx @vscode/vsce package
```

Then install the generated file from VS Code via:

- Extensions → ... → Install from VSIX

## License

MIT
