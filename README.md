# Electrolint

Electrolint is an open source VSCode plugin for Electron applications.

## Functionality

Electrolint scans Electron applications for security defects using [Electronegativity](https://github.com/doyensec/electronegativity), highlights the findings in the code, and suggests contextual remediation.

Electrolint is developed as part of my PhD research at George Washington University.

## Structure

The plugin uses the VSCode Language Server Protocol (LSP) and is built on top of [lsp-sample](https://github.com/microsoft/vscode-extension-samples/tree/master/lsp-sample).

```
.
├── client // Language Client
│   ├── src
│   │   └── extension.ts // Language Client entry point
├── package.json // The extension manifest.
└── server // Language Server
    └── src
        ├── remediation-advice.json // Collection of remediation advice items
        └── server.ts // Language Server entry point

```

## Running the Sample

- Run `npm install` in this folder. This installs all necessary npm modules in both the client and server folder
- Open VS Code on this folder.
- Press Ctrl+Shift+B to compile the client and server.
- Switch to the Debug viewlet.
- Select `Launch Client` from the drop down.
- Run the launch config.
- If you want to debug the server as well use the launch configuration `Attach to Server` after launching the client.
- In the [Extension Development Host] instance of VSCode, open an Electron document (JavaScript or TypeScript).
  - Make a change in the document.
  - Save file.
  - The extension is plugin is triggered on saving a file.
