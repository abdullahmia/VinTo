import * as moduleAlias from 'module-alias';
moduleAlias.addAlias('@', __dirname);

import * as vscode from 'vscode';
import * as commands from './commands';
import { ITodo, TodoPriority } from './models';
import { CodeTodoProvider, TodoItem, TodoTreeProvider } from './providers';
import { TodoStorageService, UserProfileService } from './services';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "personal-todo-list" is now active!');

	const storage = new TodoStorageService(context);
	const profileService = new UserProfileService(context);
	const todoProvider = new TodoTreeProvider(storage);
	const codeTodoProvider = new CodeTodoProvider(context.extensionUri);
	
	const treeView = vscode.window.createTreeView('personal-todo-list.todoView', {
		treeDataProvider: todoProvider
	});

	// Code TODOs View
	const codeTodoCodeView = vscode.window.createTreeView('personal-todo-list.codeTodoView', {
		treeDataProvider: codeTodoProvider
	});
	
	// Refresh Code TODOs on file save
	context.subscriptions.push(
		vscode.workspace.onDidSaveTextDocument((doc) => {
			codeTodoProvider.refresh(doc.uri, true);
		})
	);

	// Periodic full scan (silent/background) every 30 minutes
	const scanInterval = setInterval(() => {
		codeTodoProvider.refresh(undefined, true);
	}, 30 * 60 * 1000);
	
	context.subscriptions.push({
		dispose: () => clearInterval(scanInterval)
	});

	treeView.onDidChangeCheckboxState(e => {
		for (const [item, state] of e.items) {
			if (item instanceof TodoItem) {
				commands.toggleTodo(item, storage, todoProvider);
			}
		}
	});

	context.subscriptions.push(
		vscode.commands.registerCommand('personal-todo-list.helloWorld', () => {
			vscode.window.showInformationMessage('Hello World from Personal Todo List!');
		}),
		vscode.commands.registerCommand('personal-todo-list.addTodo', () => {
			commands.addTodo(context.extensionUri, storage, todoProvider);
		}),
		vscode.commands.registerCommand('personal-todo-list.editTodo', (item: TodoItem) => {
			commands.editTodo(context.extensionUri, item, storage, todoProvider);
		}),
		vscode.commands.registerCommand('personal-todo-list.openTodo', (todo: ITodo) => {
			commands.openTodo(context.extensionUri, todo, storage, todoProvider);
		}),
		vscode.commands.registerCommand('personal-todo-list.toggleTodo', (item: TodoItem) => {
			commands.toggleTodo(item, storage, todoProvider);
		}),
		vscode.commands.registerCommand('personal-todo-list.deleteTodo', (item: TodoItem) => {
			commands.deleteTodo(item, storage, todoProvider);
		}),

		vscode.commands.registerCommand('personal-todo-list.setPriorityHigh', (item: TodoItem) => {
			commands.setPriority(item, storage, todoProvider, TodoPriority.High);
		}),
		vscode.commands.registerCommand('personal-todo-list.setPriorityMedium', (item: TodoItem) => {
			commands.setPriority(item, storage, todoProvider, TodoPriority.Medium);
		}),
		vscode.commands.registerCommand('personal-todo-list.setPriorityLow', (item: TodoItem) => {
			commands.setPriority(item, storage, todoProvider, TodoPriority.Low);
		}),
		vscode.commands.registerCommand('personal-todo-list.setDueDate', (item: TodoItem) => {
			commands.setDueDate(item, storage, todoProvider);
		}),
		vscode.commands.registerCommand('personal-todo-list.duplicateTodo', (item: TodoItem) => {
			commands.duplicateTodo(item, storage, todoProvider);
		}),
		
		vscode.commands.registerCommand('personal-todo-list.changeViewMode', () => {
			commands.changeViewMode(todoProvider, treeView);
		}),
		vscode.commands.registerCommand('personal-todo-list.filterTodos', () => {
			commands.filterTodos(todoProvider, treeView);
		}),
		vscode.commands.registerCommand('personal-todo-list.searchTodos', () => {
			commands.searchTodos(todoProvider, treeView);
		}),
		vscode.commands.registerCommand('personal-todo-list.clearSearch', () => {
			commands.clearSearch(todoProvider, treeView);
		}),
		vscode.commands.registerCommand('personal-todo-list.setupProfile', () => {
			commands.setupProfile(context.extensionUri, profileService);
		}),
		vscode.commands.registerCommand('personal-todo-list.viewProfile', () => {
			commands.viewProfile(context.extensionUri, profileService, storage);
		}),

		vscode.commands.registerCommand('personal-todo-list.showProfileOverview', () => {
			commands.showProfileOverview(context.extensionUri, profileService, storage);
		}),
		vscode.commands.registerCommand('personal-todo-list.refreshCodeTodos', () => {
			codeTodoProvider.refresh();
		})
	);

	// Status Bar Item
	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.command = 'personal-todo-list.focusView';
	context.subscriptions.push(statusBarItem);

	const updateStatusBar = () => {
		const todos = storage.getTodos();
		const total = todos.length;
		const pending = todos.filter(t => !t.isCompleted).length;
		statusBarItem.text = `$(checklist) ${total} todos (${pending} pending)`;
		statusBarItem.tooltip = 'Click to show Personal Todo List';
		statusBarItem.show();
	};

	// Initial update
	updateStatusBar();

	// Update on changes
	todoProvider.onDidChangeTreeData(() => {
		updateStatusBar();
	});

	// Register focus command
	context.subscriptions.push(
		vscode.commands.registerCommand('personal-todo-list.focusView', () => {
			treeView.reveal(treeView.selection[0] || undefined, { focus: true });
		})
	);

	// Check for first-time setup
	if (!profileService.hasProfile()) {
		// Show setup panel after a short delay to ensure extension is fully loaded
		setTimeout(() => {
			commands.setupProfile(context.extensionUri, profileService);
		}, 500);
	}

	// Show pending tasks alert
	setTimeout(() => {
		showPendingTasksAlert(storage, treeView);
	}, 1000);
}

function showPendingTasksAlert(storage: TodoStorageService, treeView: vscode.TreeView<TodoItem | import('./providers').TodoGroupItem>) {
	// Check if setting is enabled
	const config = vscode.workspace.getConfiguration('personal-todo-list');
	const showAlert = config.get<boolean>('showPendingTasksAlert', true);

	if (!showAlert) {
		return;
	}

	// Count pending tasks
	const todos = storage.getTodos();
	const pendingCount = todos.filter(t => !t.isCompleted).length;

	if (pendingCount === 0) {
		return;
	}

	// Show notification
	const message = pendingCount === 1 
		? 'You have 1 pending task' 
		: `You have ${pendingCount} pending tasks`;

	vscode.window.showInformationMessage(
		message,
		'View Todos',
		'Dismiss',
		"Don't Show Again"
	).then(selection => {
		if (selection === 'View Todos') {
			treeView.reveal(treeView.selection[0] || undefined, { focus: true });
		} else if (selection === "Don't Show Again") {
			config.update('showPendingTasksAlert', false, vscode.ConfigurationTarget.Global);
		}
	});
}

export function deactivate() {}
