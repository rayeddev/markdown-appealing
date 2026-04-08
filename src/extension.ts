import * as vscode from 'vscode';
import { PreviewPanel } from './previewPanel';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownAppealing.openPreview', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== 'markdown') {
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
      const themes = ['clean', 'simple', 'terminal'];
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
    })
  );

  // Live update on text change
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.languageId === 'markdown' && PreviewPanel.currentPanel) {
        PreviewPanel.currentPanel.update(e.document);
      }
    })
  );

  // Update when switching to a different markdown file
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor?.document.languageId === 'markdown' && PreviewPanel.currentPanel) {
        PreviewPanel.currentPanel.update(editor.document);
      }
    })
  );
}

export function deactivate() {}
