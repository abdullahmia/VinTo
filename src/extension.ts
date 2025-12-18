import * as moduleAlias from 'module-alias';
moduleAlias.addAlias('@', __dirname);

import * as vscode from 'vscode';
import * as commands from './commands';
import { ITodo, TodoPriority } from './models';
import { TodoItem, TodoTreeProvider } from './providers';
import { TodoStorageService } from './services';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "personal-todo-list" is now active!');

	const storage = new TodoStorageService(context);
	const todoProvider = new TodoTreeProvider(storage);
	
	const treeView = vscode.window.createTreeView('personal-todo-list.todoView', {
		treeDataProvider: todoProvider
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
}

export function deactivate() {}
