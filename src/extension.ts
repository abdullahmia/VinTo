import * as vscode from 'vscode';
import { TodoItem } from './todoItem';
import { TodoTreeDataProvider } from './todoProvider';
import { TodoStorage } from './todoStorage';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "personal-todo-list" is now active!');

	const storage = new TodoStorage(context);
	const todoProvider = new TodoTreeDataProvider(storage);
	
	const treeView = vscode.window.createTreeView('personal-todo-list.todoView', {
		treeDataProvider: todoProvider
	});

	treeView.onDidChangeCheckboxState(e => {
		for (const [item, state] of e.items) {
			import('./commands').then(({ toggleTodo }) => {
				toggleTodo(item, storage, todoProvider);
			});
		}
	});

	context.subscriptions.push(
		vscode.commands.registerCommand('personal-todo-list.helloWorld', () => {
			vscode.window.showInformationMessage('Hello World from Personal Todo List!');
		}),
		vscode.commands.registerCommand('personal-todo-list.addTodo', () => {
			import('./commands').then(({ addTodo }) => {
				addTodo(context.extensionUri, storage, todoProvider);
			});
		}),
		vscode.commands.registerCommand('personal-todo-list.editTodo', (item: TodoItem) => {
			import('./commands').then(({ editTodo }) => {
				editTodo(item, storage, todoProvider);
			});
		}),
		vscode.commands.registerCommand('personal-todo-list.toggleTodo', (item: TodoItem) => {
			import('./commands').then(({ toggleTodo }) => {
				toggleTodo(item, storage, todoProvider);
			});
		}),
		vscode.commands.registerCommand('personal-todo-list.deleteTodo', (item: TodoItem) => {
			import('./commands').then(({ deleteTodo }) => {
				deleteTodo(item, storage, todoProvider);
			});
		}),
		vscode.commands.registerCommand('personal-todo-list.filterTodos', () => {
			import('./commands').then(({ filterTodos }) => {
				filterTodos(todoProvider, treeView);
			});
		}),
		vscode.commands.registerCommand('personal-todo-list.filterTodosByDate', () => {
			import('./commands').then(({ filterTodosByDate }) => {
				filterTodosByDate(todoProvider, treeView);
			});
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
			vscode.commands.executeCommand('personal-todo-list.todoView.focus');
		})
	);
}

export function deactivate() {}
