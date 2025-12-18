import { IUserProfile } from '@/models';
import { UserProfileService } from '@/services';
import * as vscode from 'vscode';

export class ProfileSetupPanel {
	public static currentPanel: ProfileSetupPanel | undefined;
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

		if (ProfileSetupPanel.currentPanel) {
			ProfileSetupPanel.currentPanel._existingProfile = existingProfile;
			ProfileSetupPanel.currentPanel._update();
			ProfileSetupPanel.currentPanel._panel.reveal(column);
			return;
		}

		const title = existingProfile ? 'Edit Profile' : 'Welcome! Setup Your Profile';

		const panel = vscode.window.createWebviewPanel(
			'profileSetupWebview',
			title,
			column || vscode.ViewColumn.One,
			{
				enableScripts: true,
				localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'assets')]
			}
		);

		ProfileSetupPanel.currentPanel = new ProfileSetupPanel(
			panel,
			extensionUri,
			profileService,
			existingProfile
		);
	}

	public dispose() {
		ProfileSetupPanel.currentPanel = undefined;

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

		// Basic email validation
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
			updatedAt: now
		};

		await this.profileService.setProfile(profile);
		
		const action = this._existingProfile ? 'updated' : 'created';
		vscode.window.showInformationMessage(`Profile ${action} successfully!`);
		
		this.dispose();
	}

	private _update() {
		this._panel.title = this._existingProfile ? 'Edit Profile' : 'Welcome! Setup Your Profile';
		this._panel.webview.html = this._getHtmlForWebview();
	}

	private _getHtmlForWebview() {
		const profile = this._existingProfile;
		const isEdit = !!profile;

		const nameVal = isEdit ? profile.name : '';
		const emailVal = isEdit ? profile.email : '';
		const githubVal = isEdit ? (profile.githubUsername || '') : '';

		const submitBtnText = isEdit ? 'Update Profile' : 'Create Profile';
		const command = 'saveProfile';

		const nonce = this._getNonce();

		return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this._panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${isEdit ? 'Edit Profile' : 'Welcome'}</title>
    <style>
        :root {
            --container-padding: 40px;
            --input-padding: 12px 16px;
            --label-margin-bottom: 8px;
            --field-margin-bottom: 24px;
            --radius: 8px;
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
            align-items: center;
            min-height: 100vh;
        }

        .container {
            width: 100%;
            max-width: 500px;
            padding: var(--container-padding);
        }

        .welcome-header {
            text-align: center;
            margin-bottom: 40px;
        }

        .welcome-header h1 {
            margin: 0 0 12px 0;
            font-size: 2em;
            font-weight: 600;
        }

        .welcome-header p {
            margin: 0;
            opacity: 0.8;
            font-size: 1.1em;
        }

        .form-group {
            margin-bottom: var(--field-margin-bottom);
        }

        label {
            display: block;
            margin-bottom: var(--label-margin-bottom);
            font-weight: 600;
            font-size: 0.95em;
        }

        label span.required {
            color: var(--vscode-inputValidation-errorBorder);
        }

        label span.optional {
            opacity: 0.6;
            font-weight: 400;
            font-size: 0.9em;
        }

        input[type="text"],
        input[type="email"] {
            width: 100%;
            padding: var(--input-padding);
            background-color: var(--input-bg);
            color: var(--input-fg);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            font-family: inherit;
            font-size: 1em;
            box-sizing: border-box;
            transition: border-color 0.2s;
        }

        input:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
            box-shadow: 0 0 0 1px var(--vscode-focusBorder);
        }

        .helper-text {
            margin-top: 6px;
            font-size: 0.85em;
            opacity: 0.7;
        }

        .actions {
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            margin-top: 40px;
        }

        button {
            padding: 12px 24px;
            border-radius: var(--radius);
            cursor: pointer;
            font-weight: 500;
            border: none;
            font-family: inherit;
            font-size: 1em;
            transition: opacity 0.2s;
        }

        button:hover {
            opacity: 0.9;
        }

        button.primary {
            background-color: var(--primary-color);
            color: var(--vscode-button-foreground);
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
            padding: 12px;
            border-radius: var(--radius);
            margin-bottom: 20px;
            display: none;
        }

        .icon {
            font-size: 3em;
            margin-bottom: 16px;
        }
    </style>
</head>
<body>
    <div class="container">
        ${!isEdit ? `
        <div class="welcome-header">
            <div class="icon">👋</div>
            <h1>Welcome to Personal Todo List!</h1>
            <p>Let's get started by setting up your profile</p>
        </div>
        ` : `
        <div class="welcome-header">
            <h1>Edit Your Profile</h1>
            <p>Update your information below</p>
        </div>
        `}
        
        <div id="error-container" class="error-message"></div>

        <form id="profile-form">
            <div class="form-group">
                <label for="name">Name <span class="required">*</span></label>
                <input type="text" id="name" name="name" placeholder="John Doe" required autocomplete="off" value="${nameVal}">
            </div>

            <div class="form-group">
                <label for="email">Email <span class="required">*</span></label>
                <input type="email" id="email" name="email" placeholder="john@example.com" required autocomplete="off" value="${emailVal}">
            </div>

            <div class="form-group">
                <label for="githubUsername">
                    GitHub Username 
                    <span class="optional">(optional)</span>
                </label>
                <input type="text" id="githubUsername" name="githubUsername" placeholder="johndoe" autocomplete="off" value="${githubVal}">
                <div class="helper-text">This can be used for future integrations</div>
            </div>

            <div class="actions">
                ${isEdit ? '<button type="button" class="secondary" id="cancel-btn">Cancel</button>' : ''}
                <button type="submit" class="primary">${submitBtnText}</button>
            </div>
        </form>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();

        const form = document.getElementById('profile-form');
        const cancelBtn = document.getElementById('cancel-btn');
        const errorContainer = document.getElementById('error-container');

        // Handle Cancel
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                vscode.postMessage({ command: 'cancel' });
            });
        }

        // Handle Submit
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            
            const name = document.getElementById('name').value.trim();
            const email = document.getElementById('email').value.trim();
            const githubUsername = document.getElementById('githubUsername').value.trim();

            if (!name) {
                showError('Name is required');
                return;
            }

            if (!email) {
                showError('Email is required');
                return;
            }

            // Basic email validation
            const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
            if (!emailRegex.test(email)) {
                showError('Please enter a valid email address');
                return;
            }

            vscode.postMessage({
                command: '${command}',
                data: {
                    name,
                    email,
                    githubUsername: githubUsername || undefined
                }
            });
        });

        function showError(message) {
            errorContainer.textContent = message;
            errorContainer.style.display = 'block';
            setTimeout(() => {
                errorContainer.style.display = 'none';
            }, 5000);
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
