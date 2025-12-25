import { ITodo } from '@/models';
import { TodoTreeProvider } from './todo-tree-provider';
import { TodoStorageService } from '@/services';
import * as vscode from 'vscode';
import { TodoPanel } from './todo-panel.webview';

export class TodoDetailPanel {
    public static currentPanel: TodoDetailPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _todo: ITodo;

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, todo: ITodo, private readonly storage: TodoStorageService, private readonly provider: TodoTreeProvider) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._todo = todo;

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'edit':
                        TodoPanel.createOrShow(this._extensionUri, this.storage, this.provider, this._todo);
                        this.dispose();
                        return;
                    case 'delete':
                        this._deleteTodo();
                        return;
                    case 'toggle':
                        this._toggleTodo();
                        return;
                    case 'startFocus':
                        this._startFocusSession();
                        return;
                    case 'close':
                        this.dispose();
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    public static createOrShow(extensionUri: vscode.Uri, todo: ITodo, storage: TodoStorageService, provider: TodoTreeProvider) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (TodoDetailPanel.currentPanel) {
            TodoDetailPanel.currentPanel._todo = todo;
            TodoDetailPanel.currentPanel._update();
            TodoDetailPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'todoDetailWebview',
            `Todo: ${todo.title}`,
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'assets')]
            }
        );

        TodoDetailPanel.currentPanel = new TodoDetailPanel(panel, extensionUri, todo, storage, provider);
    }

    public dispose() {
        TodoDetailPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private async _deleteTodo() {
        const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to delete "${this._todo.title}"?`,
            { modal: true },
            'Delete'
        );
        if (confirm === 'Delete') {
            await this.storage.deleteTodo(this._todo.id);
            this.provider.refresh();
            this.dispose();
            vscode.window.showInformationMessage(`Deleted todo: ${this._todo.title}`);
        }
    }

    private async _toggleTodo() {
        const updatedTodo = {
            ...this._todo,
            isCompleted: !this._todo.isCompleted
        };
        await this.storage.updateTodo(updatedTodo);
        this._todo = updatedTodo;
        this.provider.refresh();
        this._update(); // Refresh UI
    }

    private async _startFocusSession() {
        // Create a TodoItem-like object for the command
        const todoItem = { todo: this._todo };
        await vscode.commands.executeCommand('personal-todo-list.startFocusSession', todoItem);
    }

    private _update() {
        this._panel.title = `Todo: ${this._todo.title}`;
        this._panel.webview.html = this._getHtmlForWebview();
    }

    private _getHtmlForWebview() {
        try {
            const t = this._todo;
            if (!t) {
                return `<!DOCTYPE html><html><body><h1>Error: No Todo Data</h1></body></html>`;
            }

            // Format Dates
            const createdStr = new Date(t.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
            const dueStr = t.dueDate
                ? new Date(t.dueDate).toLocaleDateString(undefined, { dateStyle: 'medium' })
                : 'No due date';

            // Badge Colors
            const priorityColors: Record<string, string> = {
                'high': 'var(--vscode-charts-red)',
                'medium': 'var(--vscode-charts-yellow)',
                'low': 'var(--vscode-charts-green)'
            };
            const pColor = (priorityColors[t.priority.toLowerCase()] || 'var(--foreground)');

            // Tags
            let tagsHtml = '';
            if (t.tags && t.tags.length > 0) {
                tagsHtml = '<div class="tags-container">' +
                    t.tags.map(tag => `<span class="tag">${tag}</span>`).join('') +
                    '</div>';
            }

            const statusText = t.isCompleted ? 'Completed' : 'Pending';
            const statusClass = t.isCompleted ? 'status-completed' : 'status-pending';
            const toggleBtnText = t.isCompleted ? 'Mark as Incomplete' : 'Mark as Complete';

            const nonce = this._getNonce();

            return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this._panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Todo Detail</title>
    <style>
        :root {
            --foreground: var(--vscode-editor-foreground);
            --background: var(--vscode-editor-background);
            --secondary-text: var(--vscode-descriptionForeground);
            --border: var(--vscode-widget-border);
            --button-bg: var(--vscode-button-background);
            --button-fg: var(--vscode-button-foreground);
            --button-hover: var(--vscode-button-hoverBackground);
            --radius: 6px;
        }

        body {
            font-family: var(--vscode-font-family);
            color: var(--foreground);
            background-color: var(--background);
            padding: 40px 20px;
            margin: 0;
            display: flex;
            justify-content: center;
        }

        .card {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 30px;
            max-width: 600px;
            width: 100%;
            box-shadow: 0 4px 10px rgba(0,0,0,0.1);
        }

        header {
            border-bottom: 1px solid var(--border);
            padding-bottom: 20px;
            margin-bottom: 20px;
        }

        .meta-row {
            display: flex;
            gap: 12px;
            align-items: center;
            margin-bottom: 10px;
        }

        .badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            font-weight: 600;
            text-transform: uppercase;
            border: 1px solid currentColor;
        }

        .status-completed {
            color: var(--vscode-charts-green);
        }
        .status-pending {
            color: var(--secondary-text);
        }

        h1 {
            margin: 0;
            font-size: 2em;
            line-height: 1.2;
            word-wrap: break-word;
        }

        .description {
            font-size: 1.1em;
            line-height: 1.6;
            margin-bottom: 30px;
            /* white-space: pre-wrap; Removed for HTML content */
        }
        .description ul, .description ol {
            padding-left: 20px;
        }
        .description blockquote {
            border-left: 4px solid var(--border);
            padding-left: 10px;
            margin-left: 0;
            opacity: 0.8;
        }

        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
            background: var(--vscode-textBlockQuote-background);
            padding: 15px;
            border-radius: var(--radius);
        }

        .info-item label {
            display: block;
            font-size: 0.85em;
            color: var(--secondary-text);
            margin-bottom: 4px;
        }

        .info-item span {
            font-weight: 500;
        }

        .tags-container {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 5px;
        }

        .tag {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 0.85em;
        }

        .actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            padding-top: 20px;
            border-top: 1px solid var(--border);
        }

        button {
            padding: 8px 16px;
            border-radius: var(--radius);
            cursor: pointer;
            font-weight: 500;
            border: none;
            font-family: inherit;
            transition: opacity 0.2s;
        }

        button:hover {
            opacity: 0.9;
        }

        .btn-primary {
            background-color: var(--button-bg);
            color: var(--button-fg);
        }

        .btn-secondary {
            background-color: transparent;
            border: 1px solid var(--border);
            color: var(--foreground);
        }
        
        .btn-secondary:hover {
            background-color: var(--vscode-list-hoverBackground);
        }

        .btn-danger {
            background-color: var(--vscode-errorForeground);
            color: white; /* Often white ensures contrast on error colors */
        }

    </style>
</head>
<body>
    <div class="card">
        <header>
            <div class="meta-row">
                <span class="badge" style="color: ${pColor}; border-color: ${pColor}">${t.priority}</span>
                <span class="badge ${statusClass}">${statusText}</span>
            </div>
            <h1>${t.title}</h1>
        </header>

        <div class="info-grid">
            <div class="info-item">
                <label>Due Date</label>
                <span>${dueStr}</span>
            </div>
            <div class="info-item">
                <label>Created On</label>
                <span>${createdStr}</span>
            </div>
             <div class="info-item" style="grid-column: 1 / -1;">
                <label>Tags</label>
                ${tagsHtml || '<span>-</span>'}
            </div>
        </div>

        <div class="description">
            ${t.description || '<i>No description provided.</i>'}
        </div>

        <div class="actions">
            <button class="btn-secondary" id="toggle-btn">${toggleBtnText}</button>
            <button class="btn-primary" id="focus-btn" style="background-color: var(--vscode-charts-blue);">🎯 Start Focus</button>
            <button class="btn-primary" id="edit-btn">Edit</button>
            <button class="btn-danger" id="delete-btn">Delete</button>
        </div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        function sendMessage(command) {
            vscode.postMessage({ command });
        }
        
        document.getElementById('toggle-btn').addEventListener('click', () => sendMessage('toggle'));
        document.getElementById('focus-btn').addEventListener('click', () => sendMessage('startFocus'));
        document.getElementById('edit-btn').addEventListener('click', () => sendMessage('edit'));
        document.getElementById('delete-btn').addEventListener('click', () => sendMessage('delete'));
    </script>
</body>
</html>`;
        } catch (e) {
            console.error(e);
            return `<!DOCTYPE html><html><body><h1>Error rendering todo</h1><pre>${e}</pre></body></html>`;
        }
    }

    private _getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}
