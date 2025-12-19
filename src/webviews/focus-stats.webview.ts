import { FocusSessionService } from '@/services/focus-session.service';
import { TodoStorageService } from '@/services';
import * as vscode from 'vscode';
import { ITodo } from '@/models';

export class FocusStatsPanel {
	public static currentPanel: FocusStatsPanel | undefined;
	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private _disposables: vscode.Disposable[] = [];

	private constructor(
		panel: vscode.WebviewPanel,
		extensionUri: vscode.Uri,
		private readonly focusService: FocusSessionService,
		private readonly todoStorage: TodoStorageService,
		private readonly todo: ITodo
	) {
		this._panel = panel;
		this._extensionUri = extensionUri;

		this._update();

		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		this._panel.webview.onDidReceiveMessage(
			message => {
				switch (message.command) {
					case 'refresh':
						this._update();
						return;
					case 'startSession':
						vscode.commands.executeCommand('personal-todo-list.startFocusSession', { todo: this.todo });
						return;
				}
			},
			null,
			this._disposables
		);
	}

	public static createOrShow(
		extensionUri: vscode.Uri,
		focusService: FocusSessionService,
		todoStorage: TodoStorageService,
		todo: ITodo
	) {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		if (FocusStatsPanel.currentPanel) {
			FocusStatsPanel.currentPanel._update();
			FocusStatsPanel.currentPanel._panel.reveal(column);
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			'focusStatsWebview',
			`Focus Stats - ${todo.title}`,
			column || vscode.ViewColumn.One,
			{
				enableScripts: true,
				localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'assets')]
			}
		);

		FocusStatsPanel.currentPanel = new FocusStatsPanel(
			panel,
			extensionUri,
			focusService,
			todoStorage,
			todo
		);
	}

	public dispose() {
		FocusStatsPanel.currentPanel = undefined;

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

	private _getHtmlForWebview() {
		const sessions = this.focusService.getFocusSessionsForTodo(this.todo.id);
		const stats = this.focusService.getFocusStats(this.todo.id);

		// Format time helper
		const formatTime = (ms: number): string => {
			const hours = Math.floor(ms / 3600000);
			const minutes = Math.floor((ms % 3600000) / 60000);
			
			if (hours > 0) {
				return `${hours}h ${minutes}m`;
			}
			return `${minutes}m`;
		};

		// Prepare chart data
		const completedSessions = sessions.filter(s => s.completed);
		const interruptedSessions = sessions.filter(s => !s.completed);

		// Session history for line chart (last 10 sessions)
		const recentSessions = sessions.slice(-10).reverse();
		const sessionDates = recentSessions.map((s, i) => {
			const date = new Date(s.startTime);
			return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
		});
		const sessionDurations = recentSessions.map(s => Math.floor((s.actualDuration || 0) / 60000));

		// Time distribution by day of week
		const dayStats = new Array(7).fill(0);
		sessions.forEach(s => {
			const day = new Date(s.startTime).getDay();
			dayStats[day] += (s.actualDuration || 0);
		});
		const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
		const dayDurations = dayStats.map(ms => Math.floor(ms / 60000));

		const nonce = this._getNonce();

		return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this._panel.webview.cspSource} 'unsafe-inline' https://cdn.jsdelivr.net; script-src 'nonce-${nonce}' https://cdn.jsdelivr.net;">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Focus Statistics</title>
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
            --success: #4caf50;
            --warning: #ff9800;
            --error: #f44336;
            --info: #2196f3;
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
            max-width: 1400px;
            margin: 0 auto;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 32px;
        }

        h1 {
            font-size: 2em;
            font-weight: 600;
        }

        .task-title {
            font-size: 1.2em;
            opacity: 0.8;
            margin-top: 8px;
        }

        .action-buttons {
            display: flex;
            gap: 12px;
        }

        .btn {
            padding: 10px 20px;
            background-color: var(--button-bg);
            color: var(--button-fg);
            border: none;
            border-radius: var(--radius);
            cursor: pointer;
            font-family: inherit;
            font-weight: 500;
            font-size: 14px;
            transition: background-color 0.2s;
        }

        .btn:hover {
            background-color: var(--button-hover);
        }

        .btn-secondary {
            background-color: var(--secondary-bg);
            color: var(--foreground);
            border: 1px solid var(--border);
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 20px;
            margin-bottom: 32px;
        }

        .stat-card {
            background: var(--secondary-bg);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 24px;
            text-align: center;
            transition: transform 0.2s, box-shadow 0.2s;
        }

        .stat-card:hover {
            transform: translateY(-2px);
        }

        .stat-icon {
            font-size: 2em;
            margin-bottom: 12px;
        }

        .stat-value {
            font-size: 2.5em;
            font-weight: 700;
            margin-bottom: 8px;
            background: linear-gradient(135deg, var(--info), var(--success));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .stat-label {
            opacity: 0.8;
            font-size: 0.95em;
            font-weight: 500;
        }

        .stat-sublabel {
            opacity: 0.6;
            font-size: 0.85em;
            margin-top: 4px;
        }

        .charts-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
            gap: 24px;
            margin-bottom: 32px;
        }

        .chart-card {
            background: var(--secondary-bg);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 24px;
        }

        .chart-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .chart-title {
            font-size: 1.3em;
            font-weight: 600;
        }

        .chart-subtitle {
            opacity: 0.7;
            font-size: 0.9em;
            margin-top: 4px;
        }

        .chart-container {
            position: relative;
            height: 300px;
        }

        .sessions-list {
            background: var(--secondary-bg);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 24px;
        }

        .session-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px;
            border-bottom: 1px solid var(--border);
            transition: background-color 0.2s;
        }

        .session-item:last-child {
            border-bottom: none;
        }

        .session-item:hover {
            background-color: rgba(128, 128, 128, 0.1);
        }

        .session-info {
            flex: 1;
        }

        .session-date {
            font-weight: 500;
            margin-bottom: 4px;
        }

        .session-time {
            opacity: 0.7;
            font-size: 0.9em;
        }

        .session-duration {
            font-size: 1.2em;
            font-weight: 600;
            margin-right: 16px;
        }

        .session-badge {
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.85em;
            font-weight: 500;
        }

        .badge-completed {
            background-color: rgba(76, 175, 80, 0.2);
            color: var(--success);
        }

        .badge-interrupted {
            background-color: rgba(255, 152, 0, 0.2);
            color: var(--warning);
        }

        .no-data {
            text-align: center;
            padding: 60px 20px;
            opacity: 0.6;
        }

        .no-data-icon {
            font-size: 4em;
            margin-bottom: 16px;
        }

        .no-data h2 {
            margin-bottom: 12px;
        }

        @media (max-width: 1024px) {
            .charts-grid {
                grid-template-columns: 1fr;
            }
        }

        @media (max-width: 768px) {
            .header {
                flex-direction: column;
                align-items: flex-start;
                gap: 16px;
            }

            .stats-grid {
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div>
                <h1>🎯 Focus Statistics</h1>
                <div class="task-title">${this.todo.title}</div>
            </div>
            <div class="action-buttons">
                <button class="btn btn-secondary" id="refresh-btn">🔄 Refresh</button>
                <button class="btn" id="start-session-btn">▶️ Start Session</button>
            </div>
        </div>

        ${stats.totalSessions > 0 ? `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon">📊</div>
                <div class="stat-value">${stats.totalSessions}</div>
                <div class="stat-label">Total Sessions</div>
                <div class="stat-sublabel">${stats.completedSessions} completed</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">⏱️</div>
                <div class="stat-value">${formatTime(stats.totalTime)}</div>
                <div class="stat-label">Total Focus Time</div>
                <div class="stat-sublabel">Across all sessions</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">📈</div>
                <div class="stat-value">${formatTime(stats.averageSessionTime)}</div>
                <div class="stat-label">Average Session</div>
                <div class="stat-sublabel">Per completed session</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">✅</div>
                <div class="stat-value">${Math.round((stats.completedSessions / stats.totalSessions) * 100)}%</div>
                <div class="stat-label">Completion Rate</div>
                <div class="stat-sublabel">${stats.totalSessions - stats.completedSessions} interrupted</div>
            </div>
        </div>

        <div class="charts-grid">
            <div class="chart-card">
                <div class="chart-header">
                    <div>
                        <div class="chart-title">Session Completion</div>
                        <div class="chart-subtitle">Completed vs Interrupted</div>
                    </div>
                </div>
                <div class="chart-container">
                    <canvas id="completionChart"></canvas>
                </div>
            </div>

            <div class="chart-card">
                <div class="chart-header">
                    <div>
                        <div class="chart-title">Focus Time by Day</div>
                        <div class="chart-subtitle">Weekly distribution</div>
                    </div>
                </div>
                <div class="chart-container">
                    <canvas id="weeklyChart"></canvas>
                </div>
            </div>
        </div>

        ${recentSessions.length > 0 ? `
        <div class="charts-grid">
            <div class="chart-card" style="grid-column: 1 / -1;">
                <div class="chart-header">
                    <div>
                        <div class="chart-title">Session History</div>
                        <div class="chart-subtitle">Last ${recentSessions.length} sessions</div>
                    </div>
                </div>
                <div class="chart-container">
                    <canvas id="historyChart"></canvas>
                </div>
            </div>
        </div>
        ` : ''}

        <div class="sessions-list">
            <div class="chart-title" style="margin-bottom: 20px;">Recent Sessions</div>
            ${recentSessions.slice(0, 10).map(session => {
                const date = new Date(session.startTime);
                const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const duration = formatTime(session.actualDuration || 0);
                
                return `
                <div class="session-item">
                    <div class="session-info">
                        <div class="session-date">${dateStr}</div>
                        <div class="session-time">${timeStr}</div>
                    </div>
                    <div class="session-duration">${duration}</div>
                    <div class="session-badge ${session.completed ? 'badge-completed' : 'badge-interrupted'}">
                        ${session.completed ? '✓ Completed' : '⚠️ Interrupted'}
                    </div>
                </div>
                `;
            }).join('')}
        </div>
        ` : `
        <div class="no-data">
            <div class="no-data-icon">📊</div>
            <h2>No Focus Sessions Yet</h2>
            <p>Start your first focus session to see statistics and insights!</p>
            <button class="btn" id="start-first-session-btn" style="margin-top: 20px;">Start Your First Session</button>
        </div>
        `}
    </div>

    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();

        // Button handlers
        document.getElementById('refresh-btn')?.addEventListener('click', () => {
            vscode.postMessage({ command: 'refresh' });
        });

        document.getElementById('start-session-btn')?.addEventListener('click', () => {
            vscode.postMessage({ command: 'startSession' });
        });

        document.getElementById('start-first-session-btn')?.addEventListener('click', () => {
            vscode.postMessage({ command: 'startSession' });
        });

        ${stats.totalSessions > 0 ? `
        // Chart colors
        const foregroundColor = getComputedStyle(document.documentElement).getPropertyValue('--foreground');
        const gridColor = 'rgba(128, 128, 128, 0.2)';

        // Completion Chart
        const completionCtx = document.getElementById('completionChart').getContext('2d');
        new Chart(completionCtx, {
            type: 'doughnut',
            data: {
                labels: ['Completed', 'Interrupted'],
                datasets: [{
                    data: [${stats.completedSessions}, ${stats.totalSessions - stats.completedSessions}],
                    backgroundColor: [
                        'rgba(76, 175, 80, 0.8)',
                        'rgba(255, 152, 0, 0.8)'
                    ],
                    borderColor: [
                        'rgba(76, 175, 80, 1)',
                        'rgba(255, 152, 0, 1)'
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
                            color: foregroundColor,
                            padding: 20,
                            font: {
                                size: 13
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = ${stats.totalSessions};
                                const percentage = Math.round((value / total) * 100);
                                return label + ': ' + value + ' (' + percentage + '%)';
                            }
                        }
                    }
                }
            }
        });

        // Weekly Chart
        const weeklyCtx = document.getElementById('weeklyChart').getContext('2d');
        new Chart(weeklyCtx, {
            type: 'bar',
            data: {
                labels: ${JSON.stringify(dayLabels)},
                datasets: [{
                    label: 'Focus Time (minutes)',
                    data: ${JSON.stringify(dayDurations)},
                    backgroundColor: 'rgba(33, 150, 243, 0.8)',
                    borderColor: 'rgba(33, 150, 243, 1)',
                    borderWidth: 2,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const minutes = context.parsed.y;
                                const hours = Math.floor(minutes / 60);
                                const mins = minutes % 60;
                                if (hours > 0) {
                                    return hours + 'h ' + mins + 'm';
                                }
                                return mins + 'm';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: foregroundColor,
                            callback: function(value) {
                                return value + 'm';
                            }
                        },
                        grid: {
                            color: gridColor
                        }
                    },
                    x: {
                        ticks: {
                            color: foregroundColor
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });

        ${recentSessions.length > 0 ? `
        // History Chart
        const historyCtx = document.getElementById('historyChart').getContext('2d');
        new Chart(historyCtx, {
            type: 'line',
            data: {
                labels: ${JSON.stringify(sessionDates)},
                datasets: [{
                    label: 'Session Duration (minutes)',
                    data: ${JSON.stringify(sessionDurations)},
                    borderColor: 'rgba(156, 39, 176, 1)',
                    backgroundColor: 'rgba(156, 39, 176, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    pointBackgroundColor: 'rgba(156, 39, 176, 1)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.parsed.y + ' minutes';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: foregroundColor,
                            callback: function(value) {
                                return value + 'm';
                            }
                        },
                        grid: {
                            color: gridColor
                        }
                    },
                    x: {
                        ticks: {
                            color: foregroundColor
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
        ` : ''}
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
