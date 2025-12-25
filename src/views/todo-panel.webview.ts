import { ITodo, TodoPriority } from '@/models';
import { TodoTreeProvider } from './todo-tree-provider';
import { TodoStorageService } from '@/services';
import { generateUUID } from '@/utils';
import * as vscode from 'vscode';

export class TodoPanel {
    public static currentPanel: TodoPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _todoToEdit?: ITodo;

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, private readonly storage: TodoStorageService, private readonly provider: TodoTreeProvider, todoToEdit?: ITodo) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._todoToEdit = todoToEdit;

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'addTodo':
                        this._addTodo(message.data);
                        return;
                    case 'updateTodo':
                        this._updateTodo(message.data);
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

    public static createOrShow(extensionUri: vscode.Uri, storage: TodoStorageService, provider: TodoTreeProvider, todoToEdit?: ITodo) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (TodoPanel.currentPanel) {
            TodoPanel.currentPanel._todoToEdit = todoToEdit;
            TodoPanel.currentPanel._update();
            TodoPanel.currentPanel._panel.reveal(column);
            return;
        }

        const title = todoToEdit ? `Edit Todo: ${todoToEdit.title}` : 'Add New Todo';

        const panel = vscode.window.createWebviewPanel(
            'todoWebview',
            title,
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'assets')]
            }
        );

        TodoPanel.currentPanel = new TodoPanel(panel, extensionUri, storage, provider, todoToEdit);
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
        this._panel.title = this._todoToEdit ? `Edit: ${this._todoToEdit.title}` : 'Add New Todo';
        this._panel.webview.html = this._getHtmlForWebview();
    }

    private async _addTodo(data: any) {
        const { title, description, priority, dueDate, tags } = data;

        if (!title) {
            vscode.window.showErrorMessage('Title is required');
            return;
        }

        let parsedDate: number | undefined;
        if (dueDate) {
            parsedDate = Date.parse(dueDate);
        }

        const newTodo: ITodo = {
            id: generateUUID(),
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

    private async _updateTodo(data: any) {
        if (!this._todoToEdit) return;

        const { title, description, priority, dueDate, tags } = data;

        if (!title) {
            vscode.window.showErrorMessage('Title is required');
            return;
        }

        let parsedDate: number | undefined;
        if (dueDate) {
            parsedDate = Date.parse(dueDate);
            if (isNaN(parsedDate)) parsedDate = undefined;
        }

        const updatedTodo: ITodo = {
            ...this._todoToEdit,
            title,
            description,
            priority: priority as TodoPriority,
            dueDate: parsedDate,
            tags: tags ? tags.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0) : undefined
        };

        await this.storage.updateTodo(updatedTodo);
        this.provider.refresh();
        vscode.window.showInformationMessage(`Updated todo: ${title}`);
        this.dispose();
    }

    private _getHtmlForWebview() {
        const todo = this._todoToEdit;
        const isEdit = !!todo;

        const titleVal = isEdit ? todo.title : '';
        const descVal = isEdit ? (todo.description || '') : ''; // Quill will handle this
        const priorityVal = isEdit ? todo.priority : 'medium';
        const dateVal = isEdit && todo.dueDate ? new Date(todo.dueDate).toISOString().split('T')[0] : '';
        const tagsVal = isEdit && todo.tags ? todo.tags.join(', ') : '';

        const submitBtnText = isEdit ? 'Update Todo' : 'Add Todo';
        const command = isEdit ? 'updateTodo' : 'addTodo';

        // Using a nonce for security
        const nonce = this._getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this._panel.webview.cspSource} 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com; script-src 'nonce-${nonce}' https://cdn.jsdelivr.net https://unpkg.com;">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${isEdit ? 'Edit Todo' : 'Add Todo'}</title>
    
    <!-- Flatpickr CSS -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css">
    <link rel="stylesheet" type="text/css" href="https://npmcdn.com/flatpickr/dist/themes/dark.css">
    
    <!-- Quill CSS -->
    <link href="https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.snow.css" rel="stylesheet" />

    <style>
        :root {
            --container-padding: 20px;
            --input-padding: 8px 12px;
            --label-margin-bottom: 6px;
            --field-margin-bottom: 20px;
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
            padding-bottom: 60px; /* Space for scroll */
        }

        .container {
            width: 100%;
            max-width: 600px;
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

        input:focus, select:focus {
            outline: 1px solid var(--vscode-focusBorder);
            border-color: var(--vscode-focusBorder);
        }

        /* Quill Override */
        .ql-toolbar {
            border-color: var(--border) !important;
            background-color: var(--vscode-editor-background);
            border-top-left-radius: var(--radius);
            border-top-right-radius: var(--radius);
        }
        .ql-container {
            border-color: var(--border) !important;
            background-color: var(--input-bg);
            color: var(--input-fg);
            border-bottom-left-radius: var(--radius);
            border-bottom-right-radius: var(--radius);
            font-family: inherit;
            min-height: 150px;
        }
        .ql-stroke {
            stroke: var(--foreground) !important;
        }
        .ql-fill {
            fill: var(--foreground) !important;
        }
        .ql-picker {
            color: var(--foreground) !important;
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
        <h2>${isEdit ? 'Edit Todo' : 'Add New Todo'}</h2>
        
        <div id="error-container" class="error-message"></div>

        <form id="todo-form">
            <!-- Title -->
            <div class="form-group">
                <label for="title">Title <span class="required">*</span></label>
                <input type="text" id="title" name="title" placeholder="e.g. Update user profile page" required autocomplete="off" value="${titleVal}">
            </div>

            <!-- Priority & Due Date Row -->
            <div style="display: flex; gap: 20px;">
                <div class="form-group" style="flex: 1;">
                    <label for="priority">Priority</label>
                    <select id="priority" name="priority">
                        <option value="high" ${priorityVal === 'high' ? 'selected' : ''}>High</option>
                        <option value="medium" ${priorityVal === 'medium' ? 'selected' : ''}>Medium</option>
                        <option value="low" ${priorityVal === 'low' ? 'selected' : ''}>Low</option>
                    </select>
                </div>

                <div class="form-group" style="flex: 1;">
                    <label for="dueDate">Due Date</label>
                    <input type="text" id="dueDate" name="dueDate" placeholder="Select date..." value="${dateVal}">
                </div>
            </div>

            <!-- Tags -->
            <div class="form-group">
                <label for="tags">Tags</label>
                <input type="text" id="tags" name="tags" placeholder="Comma separated, e.g. work, urgent" value="${tagsVal}">
            </div>

            <!-- Description (Last) -->
            <div class="form-group">
                <label for="description">Description (Rich Text)</label>
                <!-- Quill container -->
                <div id="editor-container"></div>
                <!-- Hidden input to store initial value for script access if needed, though we inject directly js -->
            </div>

            <div class="actions">
                <button type="button" class="secondary" id="cancel-btn">Cancel</button>
                <button type="submit" class="primary">${submitBtnText}</button>
            </div>
        </form>
    </div>

    <!-- Libraries -->
    <script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>
    <script src="https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.js"></script>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();

        const form = document.getElementById('todo-form');
        const cancelBtn = document.getElementById('cancel-btn');
        const errorContainer = document.getElementById('error-container');

        // Initialize Flatpickr
        flatpickr("#dueDate", {
            dateFormat: "Y-m-d",
            theme: "dark",
            allowInput: true
        });

        // Initialize Quill
        const quill = new Quill('#editor-container', {
            theme: 'snow',
            placeholder: 'Add details...',
            modules: {
                toolbar: [
                    ['bold', 'italic', 'underline', 'strike'],
                    ['blockquote', 'code-block'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    [{ 'header': [1, 2, 3, false] }],
                    ['link', 'clean']
                ]
            }
        });

        // Set initial content for Quill
        // We need to be careful about escaping. simpler to do it via js assignment if the content is complex strings
        // But for basic usage, let's try injecting. 
        // A safer way is to use setContents or root.innerHTML via JS variable injection.
        const initialDesc = \`${descVal.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;
        quill.root.innerHTML = initialDesc;

        // Handle Cancel
        cancelBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'cancel' });
        });

        // Handle Submit
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            
            const title = document.getElementById('title').value.trim();
            if (!title) {
                showError('Title is required.');
                return;
            }

            // Get Description from Quill
            // We'll send the HTML content
            const description = quill.root.innerHTML;
            
            // Check if it's just an empty paragraph (Quill default)
            const isDescEmpty = quill.getText().trim().length === 0;
            const finalDescription = isDescEmpty ? '' : description;

            const priority = document.getElementById('priority').value;
            const dueDate = document.getElementById('dueDate').value;
            const tags = document.getElementById('tags').value;

            vscode.postMessage({
                command: '${command}',
                data: {
                    title,
                    description: finalDescription,
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

    private _getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}
