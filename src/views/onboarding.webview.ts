import { IUserProfile, ITodoStatus, DEFAULT_STATUSES } from '@/models';
import { UserProfileService, TodoStorageService } from '@/services';
import * as vscode from 'vscode';
import { generateUUID } from '@/utils';

export class UserOnboarding {
    public static currentPanel: UserOnboarding | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _existingProfile?: IUserProfile;
    private _currentStep: number = 1;
    private _tempProfileData: any = {};
    private _tempStatuses: ITodoStatus[] = [];

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        private readonly profileService: UserProfileService,
        private readonly storage: TodoStorageService,
        existingProfile?: IUserProfile
    ) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._existingProfile = existingProfile;

        // Initialize temp statuses with current or defaults
        this._tempStatuses = this.storage.getStatuses().length > 0
            ? [...this.storage.getStatuses()]
            : [...DEFAULT_STATUSES];

        this._update();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'nextStep':
                        await this._handleNextStep(message.data);
                        return;
                    case 'prevStep':
                        this._handlePrevStep();
                        return;
                    case 'saveStatus':
                        this._handleSaveStatus(message.data);
                        return;
                    case 'deleteStatus':
                        this._handleDeleteStatus(message.data);
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

    public static createOrShow(
        extensionUri: vscode.Uri,
        profileService: UserProfileService,
        storage: TodoStorageService,
        existingProfile?: IUserProfile
    ) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (UserOnboarding.currentPanel) {
            UserOnboarding.currentPanel._existingProfile = existingProfile;
            UserOnboarding.currentPanel._update();
            UserOnboarding.currentPanel._panel.reveal(column);
            return;
        }

        const title = 'Welcome to VinTo';

        const panel = vscode.window.createWebviewPanel(
            'userOnboarding',
            title,
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'assets')]
            }
        );

        UserOnboarding.currentPanel = new UserOnboarding(
            panel,
            extensionUri,
            profileService,
            storage,
            existingProfile
        );
    }

    public dispose() {
        UserOnboarding.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private async _handleNextStep(data: any) {
        if (this._currentStep === 1) {
            // Validate profile data
            const { name, email, githubUsername } = data;

            if (!name || !email) {
                vscode.window.showErrorMessage('Name and Email are required');
                return;
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                vscode.window.showErrorMessage('Please enter a valid email address');
                return;
            }

            // Store temp profile data
            this._tempProfileData = { name, email, githubUsername };
            this._currentStep = 2;
            this._update();
        } else if (this._currentStep === 2) {
            // Save everything and complete onboarding
            await this._completeOnboarding();
        }
    }

    private _handlePrevStep() {
        if (this._currentStep > 1) {
            this._currentStep--;
            this._update();
        }
    }

    private _handleSaveStatus(data: any) {
        if (data.id) {
            // Edit existing
            const index = this._tempStatuses.findIndex(s => s.id === data.id);
            if (index !== -1) {
                this._tempStatuses[index] = {
                    ...this._tempStatuses[index],
                    label: data.label,
                    color: data.color,
                    type: data.type
                };
            }
        } else {
            // Add new
            const newStatus: ITodoStatus = {
                id: generateUUID(),
                label: data.label,
                color: data.color,
                type: data.type || 'active',
                isDefault: false
            };
            this._tempStatuses.push(newStatus);
        }
        this._update();
    }

    private _handleDeleteStatus(id: string) {
        const status = this._tempStatuses.find(s => s.id === id);
        if (status?.isDefault) {
            vscode.window.showWarningMessage('Cannot delete default statuses');
            return;
        }
        this._tempStatuses = this._tempStatuses.filter(s => s.id !== id);
        this._update();
    }

    private async _completeOnboarding() {
        const now = Date.now();
        const profile: IUserProfile = {
            name: this._tempProfileData.name.trim(),
            email: this._tempProfileData.email.trim(),
            githubUsername: this._tempProfileData.githubUsername?.trim() || undefined,
            createdAt: this._existingProfile?.createdAt || now,
            updatedAt: now,
            onboardingVersion: 1
        };

        await this.profileService.setProfile(profile);
        await this.storage.saveStatuses(this._tempStatuses);

        vscode.window.showInformationMessage('Welcome! Your profile and statuses have been configured.');
        this.dispose();
    }

    private _update() {
        this._panel.title = `VinTo Setup (${this._currentStep}/2)`;
        this._panel.webview.html = this._getHtmlForWebview();
    }

    private _getHtmlForWebview() {
        const nonce = this._getNonce();
        const profile = this._existingProfile;

        const nameVal = this._tempProfileData.name || profile?.name || '';
        const emailVal = this._tempProfileData.email || profile?.email || '';
        const githubVal = this._tempProfileData.githubUsername || profile?.githubUsername || '';

        const statusesJson = JSON.stringify(this._tempStatuses);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this._panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --foreground: var(--vscode-editor-foreground);
            --background: var(--vscode-editor-background);
            --border: var(--vscode-widget-border);
            --input-bg: var(--vscode-input-background);
            --input-fg: var(--vscode-input-foreground);
            --primary: var(--vscode-button-background);
            --primary-hover: var(--vscode-button-hoverBackground);
            --radius: 8px;
            --secondary-bg: var(--vscode-textBlockQuote-background);
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            color: var(--foreground);
            background-color: var(--background);
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }

        .container {
            width: 100%;
            max-width: 600px;
            padding: 40px;
        }

        .header {
            text-align: center;
            margin-bottom: 40px;
        }

        .logo {
            font-size: 48px;
            margin-bottom: 16px;
            display: inline-block;
            animation: bounce 2s infinite ease-in-out;
        }

        @keyframes bounce {
            0%, 20%, 50%, 80%, 100% {transform: translateY(0);}
            40% {transform: translateY(-10px);}
            60% {transform: translateY(-5px);}
        }

        h1 {
            margin: 0 0 8px 0;
            font-size: 28px;
            font-weight: 700;
        }

        p.subtitle {
            margin: 0;
            opacity: 0.7;
            font-size: 16px;
            line-height: 1.5;
        }

        .step-indicator {
            display: flex;
            justify-content: center;
            gap: 8px;
            margin-bottom: 32px;
        }

        .step-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: var(--border);
            transition: all 0.3s;
        }

        .step-dot.active {
            background: var(--primary);
            width: 24px;
            border-radius: 5px;
        }

        .step-content {
            display: none;
        }

        .step-content.active {
            display: block;
        }

        .form-group {
            margin-bottom: 24px;
        }

        label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            font-size: 14px;
            opacity: 0.9;
        }

        label .optional {
            opacity: 0.5;
            font-weight: 400;
            margin-left: 4px;
        }

        input[type="text"], input[type="email"] {
            width: 100%;
            padding: 12px 16px;
            background-color: var(--input-bg);
            color: var(--input-fg);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            font-size: 15px;
            font-family: inherit;
            box-sizing: border-box;
            transition: all 0.2s;
        }

        input:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.2); 
        }

        .actions {
            margin-top: 40px;
            display: flex;
            gap: 16px;
            justify-content: flex-end;
        }

        button {
            padding: 14px 24px;
            font-size: 15px;
            font-weight: 600;
            border-radius: var(--radius);
            cursor: pointer;
            border: none;
            font-family: inherit;
            transition: transform 0.1s;
        }

        button:active {
            transform: scale(0.98);
        }

        button.primary {
            background-color: var(--primary);
            color: white;
        }
        
        button.primary:hover {
            background-color: var(--primary-hover);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }

        button.secondary {
            background-color: transparent;
            border: 1px solid var(--border);
            color: var(--foreground);
        }

        button.secondary:hover {
            background-color: rgba(128, 128, 128, 0.1);
        }

        /* Status Management */
        .status-list {
            border: 1px solid var(--border);
            border-radius: var(--radius);
            overflow: hidden;
            margin-bottom: 20px;
            max-height: 300px;
            overflow-y: auto;
        }

        .status-item {
            display: flex;
            align-items: center;
            padding: 12px 16px;
            border-bottom: 1px solid var(--border);
            background: var(--secondary-bg);
        }

        .status-item:last-child { border-bottom: none; }

        .status-badge {
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            margin-right: 12px;
            border: 1px solid currentColor;
        }

        .status-info { flex: 1; }
        .status-label { font-weight: 500; }
        .status-type { font-size: 12px; opacity: 0.6; margin-left: 8px; }

        .status-actions {
            display: flex;
            gap: 8px;
        }

        .icon-btn {
            padding: 6px;
            background: transparent;
            border: none;
            cursor: pointer;
            opacity: 0.7;
            font-size: 14px;
        }
        .icon-btn:hover { opacity: 1; background-color: var(--border); border-radius: 4px; }

        /* Modal */
        .modal {
            display: none;
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5);
            align-items: center;
            justify-content: center;
            z-index: 100;
        }
        .modal.open { display: flex; }

        .modal-content {
            background: var(--background);
            padding: 30px;
            border-radius: var(--radius);
            width: 400px;
            border: 1px solid var(--border);
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }

        .color-options {
            display: flex;
            gap: 10px;
            margin-top: 10px;
        }

        .color-option {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            cursor: pointer;
            border: 2px solid transparent;
        }
        .color-option.selected { border-color: var(--foreground); }

    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🚀</div>
            <h1>Welcome to VinTo</h1>
            <p class="subtitle">Let's get you set up in just 2 steps</p>
        </div>

        <div class="step-indicator">
            <div class="step-dot ${this._currentStep === 1 ? 'active' : ''}"></div>
            <div class="step-dot ${this._currentStep === 2 ? 'active' : ''}"></div>
        </div>

        <!-- Step 1: Profile -->
        <div id="step-1" class="step-content ${this._currentStep === 1 ? 'active' : ''}">
            <h2 style="margin-bottom: 24px;">Your Profile</h2>
            <form id="profile-form">
                <div class="form-group">
                    <label for="name">Full Name</label>
                    <input type="text" id="name" name="name" placeholder="e.g. Alex Smith" value="${nameVal}" required autocomplete="off">
                </div>

                <div class="form-group">
                    <label for="email">Email Address</label>
                    <input type="email" id="email" name="email" placeholder="e.g. alex@example.com" value="${emailVal}" required autocomplete="off">
                </div>

                <div class="form-group">
                    <label for="github">GitHub Username <span class="optional">(Optional)</span></label>
                    <input type="text" id="github" name="github" placeholder="e.g. alexsmith" value="${githubVal}" autocomplete="off">
                </div>

                <div class="actions">
                    <button type="button" class="secondary" id="cancel-btn">Cancel</button>
                    <button type="submit" class="primary">Next →</button>
                </div>
            </form>
        </div>

        <!-- Step 2: Status Configuration -->
        <div id="step-2" class="step-content ${this._currentStep === 2 ? 'active' : ''}">
            <h2 style="margin-bottom: 16px;">Configure Todo Statuses</h2>
            <p style="opacity: 0.7; margin-bottom: 24px; font-size: 14px;">Customize your workflow by adding or editing statuses</p>
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h3 style="margin: 0; font-size: 16px;">Your Statuses</h3>
                <button class="primary" id="add-status-btn" style="padding: 8px 16px; font-size: 14px;">+ Add Status</button>
            </div>

            <div class="status-list" id="status-list-container">
                <!-- Injected via JS -->
            </div>

            <div class="actions">
                <button type="button" class="secondary" id="back-btn">← Back</button>
                <button type="button" class="primary" id="finish-btn">Finish Setup</button>
            </div>
        </div>
    </div>

    <!-- Status Modal -->
    <div class="modal" id="status-modal">
        <div class="modal-content">
            <h2 id="modal-title">Add Status</h2>
            <form id="status-form">
                <input type="hidden" id="status-id">
                <input type="hidden" id="status-type">
                
                <div class="form-group">
                    <label>Label</label>
                    <input type="text" id="status-label" required placeholder="e.g. In Progress">
                </div>
                
                <div class="form-group">
                    <label>Color</label>
                    <div class="color-options" id="color-picker">
                        <div class="color-option" style="background: #3b82f6" data-color="#3b82f6"></div>
                        <div class="color-option" style="background: #10b981" data-color="#10b981"></div>
                        <div class="color-option" style="background: #f59e0b" data-color="#f59e0b"></div>
                        <div class="color-option" style="background: #ef4444" data-color="#ef4444"></div>
                        <div class="color-option" style="background: #8b5cf6" data-color="#8b5cf6"></div>
                        <div class="color-option" style="background: #6b7280" data-color="#6b7280"></div>
                    </div>
                    <input type="hidden" id="status-color" value="#3b82f6">
                </div>
                
                <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
                    <button type="button" class="secondary" id="cancel-modal">Cancel</button>
                    <button type="submit" class="primary">Save</button>
                </div>
            </form>
        </div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        let statuses = ${statusesJson};

        // Step 1: Profile Form
        const profileForm = document.getElementById('profile-form');
        if (profileForm) {
            profileForm.addEventListener('submit', (e) => {
                e.preventDefault();
                vscode.postMessage({
                    command: 'nextStep',
                    data: {
                        name: document.getElementById('name').value,
                        email: document.getElementById('email').value,
                        githubUsername: document.getElementById('github').value
                    }
                });
            });
        }

        // Cancel button
        const cancelBtn = document.getElementById('cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                vscode.postMessage({ command: 'cancel' });
            });
        }

        // Step 2: Status Management
        const backBtn = document.getElementById('back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                vscode.postMessage({ command: 'prevStep' });
            });
        }

        const finishBtn = document.getElementById('finish-btn');
        if (finishBtn) {
            finishBtn.addEventListener('click', () => {
                vscode.postMessage({ command: 'nextStep', data: {} });
            });
        }

        // Render Statuses
        const listContainer = document.getElementById('status-list-container');
        function renderStatuses() {
            if (!listContainer) return;
            listContainer.innerHTML = statuses.map(s => \`
                <div class="status-item">
                    <span class="status-badge" style="color: \${s.color}; border-color: \${s.color}">\${s.label}</span>
                    <div class="status-info">
                        <span class="status-label">\${s.label}</span>
                        \${s.isDefault ? '<span class="status-type" style="color: var(--primary)">Default</span>' : ''}
                    </div>
                    <div class="status-actions">
                        <button class="icon-btn" onclick="editStatus('\${s.id}')">✏️</button>
                        \${!s.isDefault ? \`<button class="icon-btn" onclick="deleteStatus('\${s.id}')">🗑️</button>\` : ''}
                    </div>
                </div>
            \`).join('');
        }
        renderStatuses();

        // Status Modal
        const modal = document.getElementById('status-modal');
        const statusForm = document.getElementById('status-form');

        function openModal(status = null) {
            modal.classList.add('open');
            if (status) {
                document.getElementById('modal-title').textContent = 'Edit Status';
                document.getElementById('status-id').value = status.id;
                document.getElementById('status-label').value = status.label;
                document.getElementById('status-type').value = status.type;
                selectColor(status.color);
            } else {
                document.getElementById('modal-title').textContent = 'Add Status';
                statusForm.reset();
                document.getElementById('status-id').value = '';
                document.getElementById('status-type').value = 'active';
                selectColor('#3b82f6');
            }
        }

        function closeModal() {
            modal.classList.remove('open');
        }

        const addStatusBtn = document.getElementById('add-status-btn');
        if (addStatusBtn) {
            addStatusBtn.addEventListener('click', () => openModal());
        }

        const cancelModal = document.getElementById('cancel-modal');
        if (cancelModal) {
            cancelModal.addEventListener('click', closeModal);
        }

        // Color Picker
        function selectColor(color) {
            document.getElementById('status-color').value = color;
            document.querySelectorAll('.color-option').forEach(el => {
                el.classList.toggle('selected', el.dataset.color === color);
            });
        }

        document.querySelectorAll('.color-option').forEach(el => {
            el.addEventListener('click', () => selectColor(el.dataset.color));
        });

        // Global handlers
        window.editStatus = (id) => {
            const status = statuses.find(s => s.id === id);
            if (status) openModal(status);
        };

        window.deleteStatus = (id) => {
            vscode.postMessage({ command: 'deleteStatus', data: id });
        };

        if (statusForm) {
            statusForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const id = document.getElementById('status-id').value;
                vscode.postMessage({
                    command: 'saveStatus',
                    data: {
                        id: id || null,
                        label: document.getElementById('status-label').value,
                        type: document.getElementById('status-type').value || 'active',
                        color: document.getElementById('status-color').value
                    }
                });
                closeModal();
            });
        }

        // Listen for updates from extension
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'updateStatuses') {
                statuses = message.statuses;
                renderStatuses();
            }
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
