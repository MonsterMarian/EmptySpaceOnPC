# SpaceFinder Premium

SpaceFinder Premium is a modern, fast, and secure desktop application designed to help you find and safely remove large, forgotten files to free up disk space.

## Features (V2)

- **Fast Directory Scanning**: Efficiently scans directories to find files larger than your specified threshold that haven't been accessed in a while.
- **In-App Safe Deletion**: Directly delete files from the application. Files are moved to your operating system's Recycle Bin / Trash, so you can always recover them if you make a mistake.
- **Bulk Selection**: Select multiple files at once and delete them with a single click.
- **Human Presets**: Quickly filter files using plain-English presets like "Forgotten Videos", "Old Installers", and "Huge Files".
- **Safety Indicators**: The app automatically flags files located in sensitive system directories (like `Windows`, `Program Files`, or `AppData`) with a "SYSTEM (UNSAFE)" badge to prevent accidental system damage.
- **In-App Previews**: Click on any file name to immediately open it in your system's default viewer to double-check its contents before deleting.
- **State Saving**: Your scanning preferences are saved locally so you don't have to re-enter them every time you launch the app.
- **Scan Progress**: See a live counter of how many files have been scanned to know the app is working even on massive hard drives.
- **Premium UI**: A sleek, dark-mode glassmorphic interface that is easy on the eyes.

## Tech Stack

- **Electron**: For native desktop integration (file system access, native dialogs, trash API).
- **Vite**: For blazing-fast frontend tooling.
- **Vanilla JS & CSS**: Lightweight, dependency-free frontend logic and styling.

## How to Run Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Frontend Server
Open a terminal and run:
```bash
npm run dev
```

### 3. Start Electron
Open a **second** terminal and run:
```bash
npm run electron-dev
```

## How to Build for Production
To build the frontend and package the application into a standalone executable (requires configuring Electron Forge or electron-builder):
```bash
npm run build
```

## Architecture Notes
- The application uses Electron's `contextIsolation` and a `preload.js` script to securely expose native Node.js APIs (`fs`, `shell`) to the frontend renderer.
- The `shell.trashItem()` API is specifically used instead of `fs.unlink()` to ensure all deletions are reversible by the user via the OS Recycle Bin.
