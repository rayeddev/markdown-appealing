import * as vscode from 'vscode';
import { PreviewPanel } from './previewPanel';

// Some files (e.g. SKILL.md, AGENTS.md) get claimed by other extensions and report
// a non-markdown languageId, even though they are markdown by extension. Accept both.
const MARKDOWN_EXTENSIONS = new Set(['.md', '.mkd', '.mdwn', '.mdown', '.markdown', '.mdx']);

function isMarkdownDoc(doc: vscode.TextDocument): boolean {
  if (doc.languageId === 'markdown') return true;
  const ext = doc.fileName.slice(doc.fileName.lastIndexOf('.')).toLowerCase();
  return MARKDOWN_EXTENSIONS.has(ext);
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownAppealing.openPreview', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || !isMarkdownDoc(editor.document)) {
        vscode.window.showWarningMessage('Open a markdown file first.');
        return;
      }
      PreviewPanel.createOrShow(context, editor.document);
    }),

    vscode.commands.registerCommand('markdownAppealing.switchTheme', async () => {
      const panel = PreviewPanel.currentPanel;
      if (!panel) {
        vscode.window.showWarningMessage('Open a preview first.');
        return;
      }
      const themes = ['clean', 'editorial', 'terminal'];
      const picked = await vscode.window.showQuickPick(themes, {
        placeHolder: 'Select a theme',
      });
      if (picked) {
        panel.setTheme(picked);
      }
    }),

    vscode.commands.registerCommand('markdownAppealing.toggleDarkMode', () => {
      const panel = PreviewPanel.currentPanel;
      if (!panel) {
        vscode.window.showWarningMessage('Open a preview first.');
        return;
      }
      panel.toggleDarkMode();
    }),

    vscode.commands.registerCommand('markdownAppealing.toggleFullscreen', () => {
      const panel = PreviewPanel.currentPanel;
      if (!panel) {
        vscode.window.showWarningMessage('Open a preview first.');
        return;
      }
      panel.toggleFullscreen();
    })
  );

  // Re-render when extension font settings change
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('markdownAppealing') && PreviewPanel.currentPanel) {
        const editor = vscode.window.activeTextEditor;
        if (editor && isMarkdownDoc(editor.document)) {
          PreviewPanel.currentPanel.update(editor.document);
        }
      }
    })
  );

  // Live update on text change
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (isMarkdownDoc(e.document) && PreviewPanel.currentPanel) {
        PreviewPanel.currentPanel.update(e.document);
      }
    })
  );

  // Update when switching to a different markdown file
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && isMarkdownDoc(editor.document) && PreviewPanel.currentPanel) {
        PreviewPanel.currentPanel.update(editor.document);
      }
    })
  );
}

export function deactivate() {}
