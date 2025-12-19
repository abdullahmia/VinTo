import * as vscode from 'vscode';
import { IFocusSession, IActiveFocusSession } from '@/models';

export class FocusSessionService {
	private static readonly SESSIONS_KEY = 'personal-todo-list.focusSessions';
	private static readonly ACTIVE_SESSION_KEY = 'personal-todo-list.activeFocusSession';
	private activeSessionTimer?: NodeJS.Timeout;
	private onSessionUpdateEmitter = new vscode.EventEmitter<IActiveFocusSession | undefined>();
	public readonly onSessionUpdate = this.onSessionUpdateEmitter.event;

	constructor(private context: vscode.ExtensionContext) {}

	/**
	 * Get all focus sessions
	 */
	getAllSessions(): IFocusSession[] {
		return this.context.globalState.get<IFocusSession[]>(FocusSessionService.SESSIONS_KEY, []);
	}

	/**
	 * Save all focus sessions
	 */
	private async saveSessions(sessions: IFocusSession[]): Promise<void> {
		await this.context.globalState.update(FocusSessionService.SESSIONS_KEY, sessions);
	}

	/**
	 * Get the currently active focus session
	 */
	getActiveFocusSession(): IActiveFocusSession | undefined {
		const activeSession = this.context.globalState.get<IActiveFocusSession>(FocusSessionService.ACTIVE_SESSION_KEY);
		
		if (!activeSession) {
			return undefined;
		}

		// Calculate current elapsed and remaining time
		const now = Date.now();
		const elapsedTime = now - activeSession.startTime;
		const remainingTime = Math.max(0, activeSession.duration - elapsedTime);

		return {
			...activeSession,
			elapsedTime,
			remainingTime
		};
	}

	/**
	 * Start a new focus session
	 */
	async startFocusSession(
		todoId: string,
		duration: number = 25 * 60 * 1000 // Default 25 minutes
	): Promise<IFocusSession> {
		// Stop any existing active session
		const existingSession = this.getActiveFocusSession();
		if (existingSession) {
			await this.stopFocusSession(existingSession.id, true);
		}

		// Create new session
		const session: IFocusSession = {
			id: this.generateId(),
			todoId,
			startTime: Date.now(),
			duration,
			completed: false,
			zenModeEnabled: false
		};

		// Save as active session
		await this.context.globalState.update(FocusSessionService.ACTIVE_SESSION_KEY, session);

		// Start timer
		this.startTimer(session);

		// Emit update
		this.onSessionUpdateEmitter.fire(this.getActiveFocusSession());

		return session;
	}

	/**
	 * Stop the active focus session
	 */
	async stopFocusSession(sessionId: string, interrupted: boolean = false): Promise<IFocusSession | undefined> {
		const activeSession = this.getActiveFocusSession();
		
		if (!activeSession || activeSession.id !== sessionId) {
			return undefined;
		}

		// Stop timer
		this.stopTimer();

		// Calculate actual duration
		const endTime = Date.now();
		const actualDuration = endTime - activeSession.startTime;

		// Update session
		const completedSession: IFocusSession = {
			...activeSession,
			endTime,
			actualDuration,
			completed: !interrupted
		};

		// Save to sessions history
		const sessions = this.getAllSessions();
		sessions.push(completedSession);
		await this.saveSessions(sessions);

		// Clear active session
		await this.context.globalState.update(FocusSessionService.ACTIVE_SESSION_KEY, undefined);

		// Emit update
		this.onSessionUpdateEmitter.fire(undefined);

		return completedSession;
	}

	/**
	 * Get all focus sessions for a specific todo
	 */
	getFocusSessionsForTodo(todoId: string): IFocusSession[] {
		const sessions = this.getAllSessions();
		return sessions.filter(s => s.todoId === todoId);
	}

	/**
	 * Get total focus time for a specific todo
	 */
	getTotalFocusTime(todoId: string): number {
		const sessions = this.getFocusSessionsForTodo(todoId);
		return sessions.reduce((total, session) => {
			return total + (session.actualDuration || 0);
		}, 0);
	}

	/**
	 * Get focus statistics for a todo
	 */
	getFocusStats(todoId: string): {
		totalSessions: number;
		completedSessions: number;
		totalTime: number;
		averageSessionTime: number;
	} {
		const sessions = this.getFocusSessionsForTodo(todoId);
		const completedSessions = sessions.filter(s => s.completed);
		const totalTime = this.getTotalFocusTime(todoId);
		const averageSessionTime = completedSessions.length > 0 
			? totalTime / completedSessions.length 
			: 0;

		return {
			totalSessions: sessions.length,
			completedSessions: completedSessions.length,
			totalTime,
			averageSessionTime
		};
	}

	/**
	 * Start the session timer
	 */
	private startTimer(session: IFocusSession): void {
		// Clear any existing timer
		this.stopTimer();

		// Update every second
		this.activeSessionTimer = setInterval(() => {
			const activeSession = this.getActiveFocusSession();
			
			if (!activeSession) {
				this.stopTimer();
				return;
			}

			// Check if session is complete
			if (activeSession.remainingTime <= 0) {
				this.handleSessionComplete(activeSession);
			} else {
				// Emit update for UI
				this.onSessionUpdateEmitter.fire(activeSession);
			}
		}, 1000);
	}

	/**
	 * Stop the session timer
	 */
	private stopTimer(): void {
		if (this.activeSessionTimer) {
			clearInterval(this.activeSessionTimer);
			this.activeSessionTimer = undefined;
		}
	}

	/**
	 * Handle session completion
	 */
	private async handleSessionComplete(session: IActiveFocusSession): Promise<void> {
		// Stop the session
		await this.stopFocusSession(session.id, false);

		// Show notification
		const config = vscode.workspace.getConfiguration('personal-todo-list');
		const showNotifications = config.get<boolean>('focusSession.showNotifications', true);

		if (showNotifications) {
			const minutes = Math.floor(session.duration / 60000);
			vscode.window.showInformationMessage(
				`🎯 Focus session completed! You focused for ${minutes} minutes.`,
				'Great!',
				'Take a Break'
			).then(selection => {
				if (selection === 'Take a Break') {
					// Could implement break timer here
					vscode.window.showInformationMessage('Take a 5-minute break! 🧘');
				}
			});
		}
	}

	/**
	 * Generate a unique ID for sessions
	 */
	private generateId(): string {
		return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * Cleanup when extension deactivates
	 */
	dispose(): void {
		this.stopTimer();
		this.onSessionUpdateEmitter.dispose();
	}
}
