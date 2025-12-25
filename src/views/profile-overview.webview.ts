import { TodoStorageService, UserProfileService } from '@/services';
import * as vscode from 'vscode';

export class ProfileOverviewPanel {
    public static currentPanel: ProfileOverviewPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        private readonly profileService: UserProfileService,
        private readonly todoStorage: TodoStorageService
    ) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'editProfile':
                        this._editProfile();
                        return;
                    case 'refresh':
                        this._update();
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
        todoStorage: TodoStorageService
    ) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (ProfileOverviewPanel.currentPanel) {
            ProfileOverviewPanel.currentPanel._update();
            ProfileOverviewPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'profileOverviewWebview',
            'Profile Overview',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'assets')]
            }
        );

        ProfileOverviewPanel.currentPanel = new ProfileOverviewPanel(
            panel,
            extensionUri,
            profileService,
            todoStorage
        );
    }

    public dispose() {
        ProfileOverviewPanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _editProfile() {
        const profile = this.profileService.getProfile();
        vscode.commands.executeCommand('personal-todo-list.setupProfile');
    }

    private _update() {
        this._panel.webview.html = this._getHtmlForWebview();
    }

    private _getHtmlForWebview() {
        const profile = this.profileService.getProfile();
        const todos = this.todoStorage.getTodos();

        // Calculate statistics
        const statuses = this.todoStorage.getStatuses();
        const total = todos.length;
        const completed = todos.filter(t => {
            const status = statuses.find(s => s.id === t.status);
            return status ? status.type === 'completed' : false;
        }).length;
        const pending = total - completed;
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

        const highPriority = todos.filter(t => t.priority === 'high').length;
        const mediumPriority = todos.filter(t => t.priority === 'medium').length;
        const lowPriority = todos.filter(t => t.priority === 'low').length;

        const nonce = this._getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this._panel.webview.cspSource} 'unsafe-inline' https://cdn.jsdelivr.net; script-src 'nonce-${nonce}' https://cdn.jsdelivr.net;">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Profile Overview</title>
    <style>
        :root {
            --foreground: var(--vscode-editor-foreground);
            --background: var(--vscode-editor-background);
            --border: var(--vscode-widget-border);
            --card-bg: var(--vscode-editor-background);
            --secondary-bg: var(--vscode-textBlockQuote-background);
            --button-bg: var(--vscode-button-background);
            --button-fg: var(--vscode-button-foreground);
            --button-hover: var(--vscode-button-hoverBackground);
            --radius: 8px;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--foreground);
            background-color: var(--background);
            padding: 20px;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
        }

        h1 {
            font-size: 2em;
            margin-bottom: 24px;
            font-weight: 600;
        }

        .profile-card {
            background: var(--secondary-bg);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 24px;
            margin-bottom: 24px;
        }

        .profile-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 16px;
        }

        .profile-info {
            flex: 1;
        }

        .profile-name {
            font-size: 1.5em;
            font-weight: 600;
            margin-bottom: 8px;
        }

        .profile-detail {
            margin: 6px 0;
            opacity: 0.9;
        }

        .profile-detail-label {
            opacity: 0.7;
            margin-right: 8px;
        }

        .edit-btn {
            padding: 8px 16px;
            background-color: var(--button-bg);
            color: var(--button-fg);
            border: none;
            border-radius: var(--radius);
            cursor: pointer;
            font-family: inherit;
            font-weight: 500;
        }

        .edit-btn:hover {
            background-color: var(--button-hover);
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 32px;
        }

        .stat-card {
            background: var(--secondary-bg);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 20px;
            text-align: center;
        }

        .stat-value {
            font-size: 2.5em;
            font-weight: 700;
            margin-bottom: 8px;
        }

        .stat-label {
            opacity: 0.8;
            font-size: 0.9em;
        }

        .charts-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 24px;
            margin-bottom: 32px;
        }

        .chart-card {
            background: var(--secondary-bg);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 24px;
        }

        .chart-title {
            font-size: 1.2em;
            font-weight: 600;
            margin-bottom: 16px;
        }

        .chart-container {
            position: relative;
            height: 300px;
        }

        .no-data {
            text-align: center;
            padding: 40px;
            opacity: 0.6;
        }

        .no-profile {
            text-align: center;
            padding: 60px 20px;
        }

        .no-profile h2 {
            margin-bottom: 16px;
        }

        @media (max-width: 768px) {
            .charts-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 Profile Overview</h1>

        ${profile ? `
        <div class="profile-card">
            <div class="profile-header">
                <div class="profile-info">
                    <div class="profile-name">👤 ${profile.name}</div>
                    <div class="profile-detail">
                        <span class="profile-detail-label">📧 Email:</span>
                        <span>${profile.email}</span>
                    </div>
                    ${profile.githubUsername ? `
                    <div class="profile-detail">
                        <span class="profile-detail-label">🔗 GitHub:</span>
                        <span>${profile.githubUsername}</span>
                    </div>
                    ` : ''}
                    <div class="profile-detail">
                        <span class="profile-detail-label">📅 Member since:</span>
                        <span>${new Date(profile.createdAt).toLocaleDateString()}</span>
                    </div>
                </div>
                <button class="edit-btn" id="edit-profile-btn">Edit Profile</button>
            </div>
        </div>
        ` : `
        <div class="no-profile">
            <h2>No Profile Found</h2>
            <p>Please set up your profile to see your overview.</p>
            <button class="edit-btn" id="edit-profile-btn" style="margin-top: 16px;">Create Profile</button>
        </div>
        `}

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${total}</div>
                <div class="stat-label">Total Tasks</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${completed}</div>
                <div class="stat-label">Completed</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${pending}</div>
                <div class="stat-label">Pending</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${completionRate}%</div>
                <div class="stat-label">Completion Rate</div>
            </div>
        </div>

        ${total > 0 ? `
        <div class="charts-grid">
            <div class="chart-card">
                <div class="chart-title">Completion Status</div>
                <div class="chart-container">
                    <canvas id="completionChart"></canvas>
                </div>
            </div>
            <div class="chart-card">
                <div class="chart-title">Priority Distribution</div>
                <div class="chart-container">
                    <canvas id="priorityChart"></canvas>
                </div>
            </div>
        </div>
        ` : `
        <div class="no-data">
            <p>No tasks yet. Start by adding your first todo!</p>
        </div>
        `}
    </div>

    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();

        // Edit profile button
        document.getElementById('edit-profile-btn')?.addEventListener('click', () => {
            vscode.postMessage({ command: 'editProfile' });
        });

        ${total > 0 ? `
        // Completion Chart
        const completionCtx = document.getElementById('completionChart').getContext('2d');
        new Chart(completionCtx, {
            type: 'doughnut',
            data: {
                labels: ['Completed', 'Pending'],
                datasets: [{
                    data: [${completed}, ${pending}],
                    backgroundColor: [
                        'rgba(75, 192, 192, 0.8)',
                        'rgba(255, 159, 64, 0.8)'
                    ],
                    borderColor: [
                        'rgba(75, 192, 192, 1)',
                        'rgba(255, 159, 64, 1)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--foreground'),
                            padding: 16,
                            font: {
                                size: 12
                            }
                        }
                    }
                }
            }
        });

        // Priority Chart
        const priorityCtx = document.getElementById('priorityChart').getContext('2d');
        new Chart(priorityCtx, {
            type: 'bar',
            data: {
                labels: ['High', 'Medium', 'Low'],
                datasets: [{
                    label: 'Tasks',
                    data: [${highPriority}, ${mediumPriority}, ${lowPriority}],
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.8)',
                        'rgba(255, 206, 86, 0.8)',
                        'rgba(54, 162, 235, 0.8)'
                    ],
                    borderColor: [
                        'rgba(255, 99, 132, 1)',
                        'rgba(255, 206, 86, 1)',
                        'rgba(54, 162, 235, 1)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            color: getComputedStyle(document.documentElement).getPropertyValue('--foreground')
                        },
                        grid: {
                            color: 'rgba(128, 128, 128, 0.2)'
                        }
                    },
                    x: {
                        ticks: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--foreground')
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
        ` : ''}
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
