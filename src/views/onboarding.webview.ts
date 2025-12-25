import { IUserProfile } from '@/models';
import { UserProfileService } from '@/services';
import * as vscode from 'vscode';

export class UserOnboarding {
    public static currentPanel: UserOnboarding | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _existingProfile?: IUserProfile;

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        private readonly profileService: UserProfileService,
        existingProfile?: IUserProfile
    ) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._existingProfile = existingProfile;

        this._update();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'saveProfile':
                        this._saveProfile(message.data);
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

        const title = existingProfile ? 'Edit Profile' : 'Welcome to VinTo';

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

    private async _saveProfile(data: any) {
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

        const now = Date.now();
        const profile: IUserProfile = {
            name: name.trim(),
            email: email.trim(),
            githubUsername: githubUsername?.trim() || undefined,
            createdAt: this._existingProfile?.createdAt || now,
            updatedAt: now,
            onboardingVersion: 1
        };

        await this.profileService.setProfile(profile);

        const action = this._existingProfile ? 'updated' : 'created';
        vscode.window.showInformationMessage(`Profile ${action} successfully!`);

        this.dispose();
    }

    private _update() {
        this._panel.title = this._existingProfile ? 'Edit Profile' : 'Welcome to VinTo';
        this._panel.webview.html = this._getHtmlForWebview();
    }

    private _getHtmlForWebview() {
        const profile = this._existingProfile;
        const isEdit = !!profile;
        const nonce = this._getNonce();

        const nameVal = isEdit ? profile.name : '';
        const emailVal = isEdit ? profile.email : '';
        const githubVal = isEdit ? (profile.githubUsername || '') : '';
        const submitBtnText = isEdit ? 'Save Changes' : 'Get Started';

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this._panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${isEdit ? 'Edit Profile' : 'Welcome'}</title>
    <!-- Fonts -->
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
            max-width: 480px;
            padding: 40px;
        }

        .header {
            text-align: center;
            margin-bottom: 48px;
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

        input {
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
        }

        button {
            width: 100%;
            padding: 14px;
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

        .error {
            background-color: #ff4d4f22;
            border: 1px solid #ff4d4f;
            color: #ff4d4f;
            padding: 12px;
            border-radius: var(--radius);
            margin-bottom: 24px;
            font-size: 14px;
            display: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🚀</div>
            <h1>${isEdit ? 'Update Profile' : 'Setup Your Profile'}</h1>
            <p class="subtitle">${isEdit ? 'Keep your information up to date' : 'Tell us a bit about yourself to get started'}</p>
        </div>

        <div id="error-msg" class="error"></div>

        <form id="onboarding-form">
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
                ${isEdit ? '<button type="button" class="secondary" id="cancel-btn">Cancel</button>' : ''}
                <button type="submit" class="primary" id="submit-btn">${submitBtnText}</button>
            </div>
        </form>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        const form = document.getElementById('onboarding-form');
        const errorMsg = document.getElementById('error-msg');
        const cancelBtn = document.getElementById('cancel-btn');

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                vscode.postMessage({ command: 'cancel' });
            });
        }

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            errorMsg.style.display = 'none';

            const name = document.getElementById('name').value.trim();
            const email = document.getElementById('email').value.trim();
            const github = document.getElementById('github').value.trim();

            if (!name) {
                showError('Name is required');
                return;
            }
            if (!email || !email.includes('@')) {
                showError('Valid email is required');
                return;
            }

            vscode.postMessage({
                command: 'saveProfile',
                data: {
                    name,
                    email,
                    githubUsername: github
                }
            });
        });

        function showError(msg) {
            errorMsg.textContent = msg;
            errorMsg.style.display = 'block';
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
