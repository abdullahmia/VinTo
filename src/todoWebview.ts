import * as vscode from 'vscode';
import { Todo, TodoPriority } from './todo';
import { TodoTreeDataProvider } from './todoProvider';
import { TodoStorage } from './todoStorage';

export class TodoPanel {
    public static currentPanel: TodoPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, private readonly storage: TodoStorage, private readonly provider: TodoTreeDataProvider) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        // Set the webview's initial html content
        this._update();

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'addTodo':
                        this._addTodo(message.data);
                        return;
                    case 'cancel':
                        this.dispose();
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    public static createOrShow(extensionUri: vscode.Uri, storage: TodoStorage, provider: TodoTreeDataProvider) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it.
        if (TodoPanel.currentPanel) {
            TodoPanel.currentPanel._panel.reveal(column);
            return;
        }

        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(
            'todoWebview',
            'Add New Todo',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'assets')]
            }
        );

        TodoPanel.currentPanel = new TodoPanel(panel, extensionUri, storage, provider);
    }

    public dispose() {
        TodoPanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _update() {
        this._panel.webview.html = this._getHtmlForWebview();
    }

    private async _addTodo(data: any) {
        const { title, description, priority, dueDate, tags } = data;

        // Validation (Double check server-side)
        if (!title) {
            vscode.window.showErrorMessage('Title is required');
            return;
        }

        let parsedDate: number | undefined;
        if (dueDate) {
            parsedDate = Date.parse(dueDate);
        }

        const newTodo: Todo = {
            id: this._generateUUID(), 
            title,
            description,
            priority: priority as TodoPriority,
            isCompleted: false,
            createdAt: Date.now(),
            dueDate: parsedDate,
            tags: tags ? tags.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0) : undefined
        };

        await this.storage.addTodo(newTodo);
        this.provider.refresh();
        vscode.window.showInformationMessage(`Added todo: ${title}`);
        this.dispose();
    }

    private _generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    private _getHtmlForWebview() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Add Todo</title>
    <style>
        :root {
            --container-padding: 20px;
            --input-padding: 8px 12px;
            --label-margin-bottom: 6px;
            --field-margin-bottom: 16px;
            --radius: 4px;
            --primary-color: var(--vscode-button-background);
            --primary-hover: var(--vscode-button-hoverBackground);
            --foreground: var(--vscode-editor-foreground);
            --background: var(--vscode-editor-background);
            --border: var(--vscode-input-border);
            --input-bg: var(--vscode-input-background);
            --input-fg: var(--vscode-input-foreground);
        }

        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--foreground);
            background-color: var(--background);
            padding: 0;
            margin: 0;
            display: flex;
            justify-content: center;
            padding-top: 40px;
        }

        .container {
            width: 100%;
            max-width: 500px;
            padding: var(--container-padding);
        }

        h2 {
            margin-top: 0;
            margin-bottom: 24px;
            font-weight: 500;
            font-size: 1.5em;
        }

        .form-group {
            margin-bottom: var(--field-margin-bottom);
        }

        label {
            display: block;
            margin-bottom: var(--label-margin-bottom);
            font-weight: 600;
            font-size: 0.9em;
            opacity: 0.9;
        }

        label span.required {
            color: var(--vscode-inputValidation-errorBorder);
        }

        input[type="text"],
        input[type="date"],
        textarea,
        select {
            width: 100%;
            padding: var(--input-padding);
            background-color: var(--input-bg);
            color: var(--input-fg);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            font-family: inherit;
            box-sizing: border-box; 
        }

        input:focus, textarea:focus, select:focus {
            outline: 1px solid var(--vscode-focusBorder);
            border-color: var(--vscode-focusBorder);
        }

        textarea {
            resize: vertical;
            min-height: 80px;
        }

        .actions {
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            margin-top: 32px;
        }

        button {
            padding: 8px 16px;
            border-radius: var(--radius);
            cursor: pointer;
            font-weight: 500;
            border: none;
            font-family: inherit;
        }

        button.primary {
            background-color: var(--primary-color);
            color: var(--vscode-button-foreground);
        }

        button.primary:hover {
            background-color: var(--primary-hover);
        }

        button.secondary {
            background-color: transparent;
            color: var(--foreground);
            border: 1px solid var(--border);
        }

        button.secondary:hover {
            background-color: var(--vscode-list-hoverBackground);
        }

        /* Error state tailored for VS Code */
        .error-message {
            color: var(--vscode-inputValidation-errorForeground);
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            padding: 8px;
            border-radius: var(--radius);
            margin-bottom: 16px;
            display: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <h2>Add New Todo</h2>
        
        <div id="error-container" class="error-message"></div>

        <form id="todo-form">
            <div class="form-group">
                <label for="title">Title <span class="required">*</span></label>
                <input type="text" id="title" name="title" placeholder="e.g. Update user profile page" required autocomplete="off">
            </div>

            <div class="form-group">
                <label for="description">Description</label>
                <textarea id="description" name="description" placeholder="Add details..."></textarea>
            </div>

            <div class="form-group">
                <label for="priority">Priority</label>
                <select id="priority" name="priority">
                    <option value="High">High</option>
                    <option value="Medium" selected>Medium</option>
                    <option value="Low">Low</option>
                </select>
            </div>

            <div class="form-group">
                <label for="dueDate">Due Date</label>
                <input type="date" id="dueDate" name="dueDate">
            </div>

            <div class="form-group">
                <label for="tags">Tags</label>
                <input type="text" id="tags" name="tags" placeholder="Comma separated, e.g. work, urgent">
            </div>

            <div class="actions">
                <button type="button" class="secondary" id="cancel-btn">Cancel</button>
                <button type="submit" class="primary">Add Todo</button>
            </div>
        </form>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        const form = document.getElementById('todo-form');
        const cancelBtn = document.getElementById('cancel-btn');
        const errorContainer = document.getElementById('error-container');

        // Handle Cancel
        cancelBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'cancel' });
        });

        // Handle Submit
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            
            // Basic client-side validation logic
            const title = document.getElementById('title').value.trim();
            if (!title) {
                showError('Title is required.');
                return;
            }

            const description = document.getElementById('description').value.trim();
            const priority = document.getElementById('priority').value;
            const dueDate = document.getElementById('dueDate').value;
            const tags = document.getElementById('tags').value;

            vscode.postMessage({
                command: 'addTodo',
                data: {
                    title,
                    description,
                    priority,
                    dueDate,
                    tags
                }
            });
        });

        function showError(message) {
            errorContainer.textContent = message;
            errorContainer.style.display = 'block';
        }
    </script>
</body>
</html>`;
    }
}
