import { ITodo, TodoPriority } from '@/models';
import { TodoTreeProvider } from './todo-tree-provider';
import { TodoStorageService } from '@/services';
import { generateUUID } from '@/utils';
import * as vscode from 'vscode';
import TurndownService = require('turndown');
import { marked } from 'marked';

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
            async message => {
                switch (message.command) {
                    case 'addTodo':
                        await this._addTodo(message.data);
                        return;
                    case 'updateTodo':
                        await this._updateTodo(message.data);
                        return;
                    case 'cancel':
                        this.dispose();
                        return;
                    case 'convertHtmlToMarkdown':
                        const markdown = this._convertHtmlToMarkdown(message.data.html);
                        this._panel.webview.postMessage({ command: 'updateMarkdown', content: markdown });
                        return;
                    case 'convertMarkdownToHtml':
                        const html = this._convertMarkdownToHtml(message.data.markdown);
                        this._panel.webview.postMessage({ command: 'updateHtml', content: html });
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
        const { title, descriptionHtml, isTiptap, priority, dueDate, tags } = data;

        if (!title) {
            vscode.window.showErrorMessage('Title is required');
            return;
        }

        // Convert HTML (Quill or Tiptap) -> Markdown for storage
        const finalDescription = this._convertHtmlToMarkdown(descriptionHtml);

        let parsedDate: number | undefined;
        if (dueDate) {
            parsedDate = Date.parse(dueDate);
        }

        const newTodo: ITodo = {
            id: generateUUID(),
            title,
            description: finalDescription,
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

        const { title, descriptionHtml, isTiptap, priority, dueDate, tags } = data;

        if (!title) {
            vscode.window.showErrorMessage('Title is required');
            return;
        }

        // Convert HTML (Quill or Tiptap) -> Markdown for storage
        const finalDescription = this._convertHtmlToMarkdown(descriptionHtml);

        let parsedDate: number | undefined;
        if (dueDate) {
            parsedDate = Date.parse(dueDate);
            if (isNaN(parsedDate)) parsedDate = undefined;
        }

        const updatedTodo: ITodo = {
            ...this._todoToEdit,
            title,
            description: finalDescription,
            priority: priority as TodoPriority,
            dueDate: parsedDate,
            tags: tags ? tags.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0) : undefined
        };

        await this.storage.updateTodo(updatedTodo);
        this.provider.refresh();
        vscode.window.showInformationMessage(`Updated todo: ${title}`);
        this.dispose();
    }

    private _convertHtmlToMarkdown(html: string): string {
        const turndownService = new TurndownService({
            headingStyle: 'atx',
            codeBlockStyle: 'fenced',
            bulletListMarker: '-'
        });

        // Ensure task lists are processed if present in HTML
        turndownService.addRule('taskList', {
            filter: function (node) {
                return node.nodeName === 'LI' && node.hasAttribute('data-checked');
            },
            replacement: function (content, node) {
                const isChecked = (node as any).getAttribute('data-checked') === 'true';
                return (isChecked ? '- [x] ' : '- [ ] ') + content + '\n';
            }
        });

        turndownService.addRule('taskListContainer', {
            filter: function (node) {
                return node.nodeName === 'UL' && (node as any).getAttribute('data-type') === 'taskList';
            },
            replacement: function (content) {
                return content;
            }
        });

        return turndownService.turndown(html);
    }

    private _convertMarkdownToHtml(markdownContent: string): string {
        return marked(markdownContent, { async: false }) as string;
    }

    private _getHtmlForWebview() {
        const todo = this._todoToEdit;
        const isEdit = !!todo;

        const titleVal = isEdit ? todo.title : '';
        const rawDesc = isEdit ? (todo.description || '') : '';
        const htmlDesc = this._convertMarkdownToHtml(rawDesc);

        const priorityVal = isEdit ? todo.priority : 'medium';
        const dateVal = isEdit && todo.dueDate ? new Date(todo.dueDate).toISOString().split('T')[0] : '';
        const tagsVal = isEdit && todo.tags ? todo.tags.join(', ') : '';

        const submitBtnText = isEdit ? 'Update Todo' : 'Add Todo';
        const command = isEdit ? 'updateTodo' : 'addTodo';

        const nonce = this._getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this._panel.webview.cspSource} 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'nonce-${nonce}' https://cdn.jsdelivr.net https://unpkg.com https://esm.sh 'unsafe-eval'; connect-src https://esm.sh;">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${isEdit ? 'Edit Todo' : 'Add Todo'}</title>
    
    <!-- Flatpickr CSS -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css">
    <link rel="stylesheet" type="text/css" href="https://npmcdn.com/flatpickr/dist/themes/dark.css">
    
    <!-- Quill CSS -->
    <link href="https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.snow.css" rel="stylesheet" />
    
    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">

    <style>
        :root {
            --container-padding: 30px;
            --input-padding: 10px 12px;
            --label-margin-bottom: 8px;
            --field-margin-bottom: 24px;
            --radius: 6px;
            --primary-color: var(--vscode-button-background);
            --primary-hover: var(--vscode-button-hoverBackground);
            --foreground: var(--vscode-editor-foreground);
            --background: var(--vscode-editor-background);
            --border: var(--vscode-widget-border);
            --input-bg: var(--vscode-input-background);
            --input-fg: var(--vscode-input-foreground);
            --placeholder: var(--vscode-input-placeholderForeground);
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            color: var(--foreground);
            background-color: var(--background);
            padding: 0;
            margin: 0;
            display: flex;
            justify-content: center;
        }

        .container {
            width: 100%;
            max-width: 800px;
            padding: var(--container-padding);
            padding-bottom: 60px;
        }

        h2 {
            margin-top: 0;
            margin-bottom: 30px;
            font-weight: 600;
            font-size: 1.8em;
            border-bottom: 1px solid var(--border);
            padding-bottom: 15px;
        }

        .form-group {
            margin-bottom: var(--field-margin-bottom);
        }

        label {
            display: block;
            margin-bottom: var(--label-margin-bottom);
            font-weight: 500;
            font-size: 0.95em;
            color: var(--vscode-descriptionForeground);
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
            font-size: 14px;
            transition: border-color 0.2s;
        }

        input:focus, select:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }

        /* Toggle Switch for Editor Mode */
        .editor-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        
        .toggle-container {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 0.9em;
        }

        .switch {
            position: relative;
            display: inline-block;
            width: 40px;
            height: 20px;
        }

        .switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }

        .slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: var(--vscode-widget-border);
            transition: .4s;
            border-radius: 34px;
        }

        .slider:before {
            position: absolute;
            content: "";
            height: 16px;
            width: 16px;
            left: 2px;
            bottom: 2px;
            background-color: white;
            transition: .4s;
            border-radius: 50%;
        }

        input:checked + .slider {
            background-color: #2196F3;
        }

        input:focus + .slider {
            box-shadow: 0 0 1px #2196F3;
        }

        input:checked + .slider:before {
            transform: translateX(20px);
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
            min-height: 200px;
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
        
        /* Tiptap Editor Styling */
        .editor-wrapper-tiptap {
            border: 1px solid var(--border);
            border-radius: var(--radius);
            background-color: var(--input-bg);
            min-height: 242px; /* Similar to Quill */
            cursor: text;
            padding: 20px;
        }
        
        .editor-wrapper-tiptap:focus-within {
            border-color: var(--vscode-focusBorder);
        }

        .ProseMirror {
            outline: none;
            min-height: 200px; /* Ensure clickability */
        }
        
        .ProseMirror > *:first-child {
            margin-top: 0;
        }
        
        /* Tiptap Content Styles */
        .ProseMirror p { margin-bottom: 0.8em; line-height: 1.6; }
        .ProseMirror h1, .ProseMirror h2, .ProseMirror h3 { margin-top: 1.5em; margin-bottom: 0.5em; font-weight: 600; }
        .ProseMirror h1 { font-size: 2em; }
        .ProseMirror h2 { font-size: 1.5em; }
        .ProseMirror h3 { font-size: 1.25em; }
        
        .ProseMirror ul, .ProseMirror ol { padding-left: 1.5em; margin-bottom: 1em; }
        .ProseMirror li { margin-bottom: 0.3em; }
        
        .ProseMirror blockquote {
            border-left: 3px solid var(--vscode-textBlockQuote-border);
            padding-left: 1rem;
            margin-left: 0;
            color: var(--vscode-textBlockQuote-background);
            font-style: italic;
        }
        
        .ProseMirror pre {
            background: var(--vscode-textCodeBlock-background);
            border-radius: 4px;
            padding: 0.75rem 1rem;
            font-family: 'JetBrains Mono', monospace;
            code {
                background: none;
                padding: 0;
                color: inherit;
            }
        }
        
        .ProseMirror code {
            font-family: 'JetBrains Mono', monospace;
            background-color: var(--vscode-textCodeBlock-background);
            padding: 0.2em 0.4em;
            border-radius: 3px;
            font-size: 0.9em;
        }

        .ProseMirror ul[data-type="taskList"] {
            list-style: none;
            padding: 0;
        }
        
        .ProseMirror ul[data-type="taskList"] li {
            display: flex;
            align-items: flex-start;
        }
        
        .ProseMirror ul[data-type="taskList"] li > label {
            margin-right: 0.5rem;
            margin-bottom: 0;
            user-select: none;
            margin-top: 0.2em;
        }

        .ProseMirror p.is-editor-empty:first-child::before {
            color: var(--placeholder);
            content: attr(data-placeholder);
            float: left;
            height: 0;
            pointer-events: none;
        }

        .actions {
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            margin-top: 32px;
        }

        button {
            padding: 10px 20px;
            border-radius: var(--radius);
            cursor: pointer;
            font-weight: 500;
            border: none;
            font-family: inherit;
            font-size: 14px;
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
        
        .row {
            display: flex;
            gap: 20px;
        }
        
        .col { flex: 1; }
        
        .hidden {
            display: none !important;
        }
    </style>
</head>
<body>
    <div class="container">
        <h2>${isEdit ? 'Edit Todo' : 'Add New Todo'}</h2>
        
        <form id="todo-form">
            <!-- Title -->
            <div class="form-group">
                <label for="title">Title</label>
                <input type="text" id="title" name="title" placeholder="What needs to be done?" required autocomplete="off" value="${titleVal}">
            </div>

            <!-- Priority & Due Date Row -->
            <div class="row">
                <div class="form-group col">
                    <label for="priority">Priority</label>
                    <select id="priority" name="priority">
                        <option value="high" ${priorityVal === 'high' ? 'selected' : ''}>High</option>
                        <option value="medium" ${priorityVal === 'medium' ? 'selected' : ''}>Medium</option>
                        <option value="low" ${priorityVal === 'low' ? 'selected' : ''}>Low</option>
                    </select>
                </div>

                <div class="form-group col">
                    <label for="dueDate">Due Date</label>
                    <input type="text" id="dueDate" name="dueDate" placeholder="Select date..." value="${dateVal}">
                </div>
            </div>

            <!-- Tags -->
            <div class="form-group">
                <label for="tags">Tags</label>
                <input type="text" id="tags" name="tags" placeholder="Comma separated, e.g. work, project" value="${tagsVal}">
            </div>

            <!-- Editors with Toggle -->
            <div class="form-group">
                <div class="editor-header">
                    <label style="margin: 0;">Description</label>
                    <div class="toggle-container">
                        <span>Rich Text (Quill)</span>
                        <label class="switch">
                            <input type="checkbox" id="editor-toggle">
                            <span class="slider"></span>
                        </label>
                        <span>Markdown (Tiptap)</span>
                    </div>
                </div>

                <!-- Rich Text Editor (Quill) -->
                <div id="quill-wrapper">
                    <div id="quill-editor"></div>
                </div>

                <!-- Inline Markdown Editor (Tiptap) -->
                <div id="tiptap-wrapper" class="hidden">
                    <div class="editor-wrapper-tiptap">
                        <div id="tiptap-editor"></div>
                    </div>
                     <div style="margin-top: 8px; font-size: 0.8em; color: var(--vscode-descriptionForeground); opacity: 0.8;">
                        Markdown support enabled. Type <code>#</code> for heading, <code>-</code> for list, <code>**</code> for bold.
                    </div>
                </div>
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

    <script type="module" nonce="${nonce}">
        // Import Tiptap from esm.sh
        import { Editor } from 'https://esm.sh/@tiptap/core@2.2.4';
        import StarterKit from 'https://esm.sh/@tiptap/starter-kit@2.2.4';
        import Placeholder from 'https://esm.sh/@tiptap/extension-placeholder@2.2.4';
        import TaskList from 'https://esm.sh/@tiptap/extension-task-list@2.2.4';
        import TaskItem from 'https://esm.sh/@tiptap/extension-task-item@2.2.4';
        import Link from 'https://esm.sh/@tiptap/extension-link@2.2.4';

        const vscode = acquireVsCodeApi();

        const form = document.getElementById('todo-form');
        const cancelBtn = document.getElementById('cancel-btn');
        
        const editorToggle = document.getElementById('editor-toggle');
        const quillWrapper = document.getElementById('quill-wrapper');
        const tiptapWrapper = document.getElementById('tiptap-wrapper');
        
        let initialContent = ${JSON.stringify(htmlDesc)};
        let currentMode = 'quill'; // 'quill' or 'tiptap'
        
        // Initialize Flatpickr
        flatpickr("#dueDate", {
            dateFormat: "Y-m-d",
            theme: "dark",
            allowInput: true
        });

        // Initialize Quill
        const quill = new Quill('#quill-editor', {
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
        quill.root.innerHTML = initialContent;

        // Initialize Tiptap
        const tiptapEditor = new Editor({
            element: document.querySelector('#tiptap-editor'),
            extensions: [
                StarterKit.configure({
                    heading: { levels: [1, 2, 3] },
                    codeBlock: { languageClassPrefix: 'language-', HTMLAttributes: { class: 'code-block' } },
                }),
                Placeholder.configure({
                    placeholder: 'Write markdown here...',
                }),
                TaskList,
                TaskItem.configure({
                    nested: true,
                }),
                Link.configure({
                    openOnClick: false,
                })
            ],
            content: initialContent, // Sync initial content
            editorProps: {
                attributes: {
                    class: 'ProseMirror', 
                },
            },
        });
        
        // Focus Tiptap wrapper logic
        document.querySelector('.editor-wrapper-tiptap').addEventListener('click', () => {
            if (!tiptapEditor.isFocused) {
                tiptapEditor.commands.focus();
            }
        });

        // Toggle Logic
        editorToggle.addEventListener('change', (e) => {
             const isTiptap = e.target.checked;
             
             if (isTiptap) {
                 // Switch TO Tiptap (Markdown Mode)
                 currentMode = 'tiptap';
                 
                 // Get HTML from Quill
                 const html = quill.root.innerHTML;
                 
                 // Update Tiptap
                 tiptapEditor.commands.setContent(html);
                 
                 // Show Tiptap, Hide Quill
                 tiptapWrapper.classList.remove('hidden');
                 quillWrapper.classList.add('hidden');
                 
             } else {
                 // Switch TO Quill (Rich Text Mode)
                 currentMode = 'quill';
                 
                 // Get HTML from Tiptap
                 const html = tiptapEditor.getHTML();
                 
                 // Update Quill
                 quill.root.innerHTML = html;
                 
                 // Show Quill, Hide Tiptap
                 quillWrapper.classList.remove('hidden');
                 tiptapWrapper.classList.add('hidden');
             }
        });

        // Handle Cancel
        cancelBtn.addEventListener('click', () => {
             vscode.postMessage({ command: 'cancel' });
        });

        // Handle Submit
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            
            const title = document.getElementById('title').value.trim();
            if (!title) {
                return;
            }

            // Get Content based on active editor
            let descriptionHtml = '';
            
            if (currentMode === 'quill') {
                descriptionHtml = quill.root.innerHTML;
            } else {
                descriptionHtml = tiptapEditor.getHTML();
            }

            const priority = document.getElementById('priority').value;
            const dueDate = document.getElementById('dueDate').value;
            const tags = document.getElementById('tags').value;

            vscode.postMessage({
                command: '${command}',
                data: {
                    title,
                    descriptionHtml,
                    isTiptap: currentMode === 'tiptap',
                    priority,
                    dueDate,
                    tags
                }
            });
        });
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
