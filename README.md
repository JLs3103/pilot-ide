# Pilot IDE

Pilot IDE is an AI-powered desktop development environment for exploring, editing, and managing software projects in one workspace. It combines a Go backend with a React and TypeScript interface, built as a desktop app with Wails.

![Pilot IDE screenshot](<reference_image/pilot_ide.png>)

## Features

- **Code editor:** Monaco Editor with tab management, syntax highlighting, formatting, and code snippets.
- **AI coding assistant:** Work with project files using local Ollama models or the Google Gemini API.
- **AI change review:** Inspect file changes made by the assistant, then accept or revert them.
- **Project tools:** Browse files, search and replace across a project, and use the integrated terminal.
- **Git source control:** Review changes, stage files, and manage commits from the IDE.
- **Customizable workspace:** Configure editor preferences and adjust the layout.

## Technology

- **Desktop/backend:** Go, Wails
- **Frontend:** React, TypeScript
- **Editor:** Monaco Editor
- **Local storage:** SQLite
- **AI providers:** Ollama, Google Gemini API

## Getting Started

### Prerequisites

- Go 1.25 or later
- Node.js and npm
- Wails CLI v2
- Git

For platform-specific system dependencies, see the [Wails installation guide](https://wails.io/docs/gettingstarted/installation).

Install the Wails CLI if needed:

```sh
go install github.com/wailsapp/wails/v2/cmd/wails@v2.16.0
```

### Run in development

```sh
git clone https://github.com/JLs3103/pilot-ide.git
cd pilot-ide
cd frontend
npm install
cd ..
wails dev
```

### Build

From the project root, run:

```sh
wails build
```

The built application is placed in `build/bin`.

## AI Setup

Choose a provider in the AI panel:

- **Local — Ollama:** Install [Ollama](https://ollama.com/) and download the default model:

  ```sh
  ollama pull qwen2.5-coder:7b
  ```

  Pilot IDE uses the local Ollama service and attempts to start it automatically when the app launches.

- **Cloud — Gemini:** Select the Gemini mode and provide a Google Gemini API key in the AI panel. The key is saved encrypted in the local SQLite store.

## License

No license has been specified for this repository.
