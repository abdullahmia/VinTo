import * as vscode from 'vscode';
import { TodoItem } from '@/providers';
import { FocusSessionService } from '@/services/focus-session.service';
import { TodoStorageService } from '@/services/todo-storage.service';
import { TodoTreeProvider } from '@/providers/todo-tree-provider';

/**
 * Start a focus session for a todo item
 */
export async function startFocusSession(
	item: TodoItem,
	focusService: FocusSessionService,
	storage: TodoStorageService,
	todoProvider: TodoTreeProvider
): Promise<void> {
	const config = vscode.workspace.getConfiguration('personal-todo-list');
	const defaultDuration = config.get<number>('focusSession.defaultDuration', 25);

	// Ask for duration
	const durationInput = await vscode.window.showQuickPick([
		{ label: '15 minutes', value: 15 },
		{ label: '25 minutes', value: 25 },
		{ label: '45 minutes', value: 45 },
		{ label: '60 minutes', value: 60 },
		{ label: 'Custom...', value: -1 }
	], {
		placeHolder: 'Select focus session duration'
	});

	if (!durationInput) {
		return;
	}

	let duration = durationInput.value;

	// Handle custom duration
	if (duration === -1) {
		const customInput = await vscode.window.showInputBox({
			prompt: 'Enter custom duration in minutes',
			placeHolder: '25',
			validateInput: (value) => {
				const num = parseInt(value);
				if (isNaN(num) || num <= 0 || num > 180) {
					return 'Please enter a valid number between 1 and 180';
				}
				return null;
			}
		});

		if (!customInput) {
			return;
		}

		duration = parseInt(customInput);
	}

	// Start the session
	const session = await focusService.startFocusSession(
		item.todo.id,
		duration * 60 * 1000 // Convert to milliseconds
	);

	// Update todo with active session
	const updatedTodo = {
		...item.todo,
		activeFocusSessionId: session.id,
		focusSessions: [...(item.todo.focusSessions || []), session.id]
	};

	await storage.updateTodo(updatedTodo);
	todoProvider.refresh();

	// Show confirmation
	vscode.window.showInformationMessage(
		`🎯 Focus session started for "${item.todo.title}" (${duration} minutes)`
	);
}

/**
 * Stop the active focus session
 */
export async function stopFocusSession(
	focusService: FocusSessionService,
	storage: TodoStorageService,
	todoProvider: TodoTreeProvider
): Promise<void> {
	const activeSession = focusService.getActiveFocusSession();

	if (!activeSession) {
		vscode.window.showWarningMessage('No active focus session');
		return;
	}

	// Confirm stopping
	const choice = await vscode.window.showWarningMessage(
		'Stop the current focus session?',
		{ modal: true },
		'Stop Session',
		'Cancel'
	);

	if (choice !== 'Stop Session') {
		return;
	}

	// Stop the session
	const completedSession = await focusService.stopFocusSession(activeSession.id, true);

	if (completedSession) {
		// Update todo
		const todos = storage.getTodos();
		const todo = todos.find(t => t.id === completedSession.todoId);

		if (todo) {
			const totalFocusTime = focusService.getTotalFocusTime(todo.id);
			const updatedTodo = {
				...todo,
				activeFocusSessionId: undefined,
				totalFocusTime
			};

			await storage.updateTodo(updatedTodo);
			todoProvider.refresh();
		}

		// Show summary
		const minutes = Math.floor((completedSession.actualDuration || 0) / 60000);
		vscode.window.showInformationMessage(
			`Focus session stopped. You focused for ${minutes} minutes.`
		);
	}
}

/**
 * View focus statistics for a todo
 */
export async function viewFocusStats(
	extensionUri: vscode.Uri,
	item: TodoItem,
	focusService: FocusSessionService,
	storage: TodoStorageService
): Promise<void> {
	const { FocusStatsPanel } = await import('@/webviews/focus-stats.webview');
	FocusStatsPanel.createOrShow(extensionUri, focusService, storage, item.todo);
}

