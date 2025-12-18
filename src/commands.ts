import * as vscode from 'vscode';
import { Todo, TodoPriority } from './todo';
import { TodoItem } from './todoItem';
import { TodoTreeDataProvider } from './todoProvider';
import { TodoStorage } from './todoStorage';
import { TodoPanel } from './todoWebview';

export async function addTodo(extensionUri: vscode.Uri, storage: TodoStorage, provider: TodoTreeDataProvider) {
	TodoPanel.createOrShow(extensionUri, storage, provider);
}

import { TodoDetailPanel } from './todoDetailWebview';

export async function openTodo(extensionUri: vscode.Uri, todo: Todo, storage: TodoStorage, provider: TodoTreeDataProvider) {
    // vscode.window.showInformationMessage(`Open Todo: ${JSON.stringify(todo)}`);
    TodoDetailPanel.createOrShow(extensionUri, todo, storage, provider);
}

export async function editTodo(extensionUri: vscode.Uri, item: TodoItem, storage: TodoStorage, provider: TodoTreeDataProvider) {
    TodoPanel.createOrShow(extensionUri, storage, provider, item.todo);
}

export async function toggleTodo(item: TodoItem, storage: TodoStorage, provider: TodoTreeDataProvider) {
	const todo = item.todo;
	const updatedTodo: Todo = {
		...todo,
		isCompleted: !todo.isCompleted
	};
	await storage.updateTodo(updatedTodo);
	provider.refresh();
}

export async function deleteTodo(item: TodoItem, storage: TodoStorage, provider: TodoTreeDataProvider) {
	const confirm = await vscode.window.showWarningMessage(
		`Are you sure you want to delete "${item.todo.title}"?`,
		{ modal: true },
		'Delete'
	);

	if (confirm === 'Delete') {
		await storage.deleteTodo(item.todo.id);
		provider.refresh();
		vscode.window.showInformationMessage(`Deleted todo: ${item.todo.title}`);
	}
}

export async function filterTodos(provider: TodoTreeDataProvider, treeView: vscode.TreeView<TodoItem>) {
	const options = ['All', 'high', 'medium', 'low'];
	const selection = await vscode.window.showQuickPick(options, {
		placeHolder: 'Select priority to filter by'
	});

	if (selection) {
		provider.setFilter(selection as TodoPriority | 'All');
		
		let title = 'Personal Todo List';
		if (selection !== 'All') {
			title += ` (Filter: ${selection})`;
		}
		// Note: This overrides any date filter title. A more robust solution would manage both.
		treeView.title = title;
	}
}

export async function filterTodosByDate(provider: TodoTreeDataProvider, treeView: vscode.TreeView<TodoItem>) {
	const options = ['All', 'Today', 'This Week', 'Overdue', 'Custom Date'];
	const selection = await vscode.window.showQuickPick(options, {
		placeHolder: 'Select date filter'
	});

	if (selection) {
		if (selection === 'Custom Date') {
			const dateString = await vscode.window.showInputBox({
				prompt: 'Enter date to filter by (YYYY-MM-DD)',
				placeHolder: 'YYYY-MM-DD'
			});
			if (dateString) {
				const parsedDate = Date.parse(dateString);
				if (!isNaN(parsedDate)) {
					provider.setDateFilter({ custom: parsedDate });
					treeView.title = `Personal Todo List (Date: ${dateString})`; // Simplified title management
				}
			}
		} else {
			let filter: 'All' | 'Today' | 'Week' | 'Overdue' = 'All';
			if (selection === 'Today') filter = 'Today';
			else if (selection === 'This Week') filter = 'Week';
			else if (selection === 'Overdue') filter = 'Overdue';
			
			provider.setDateFilter(filter);
			
			let title = 'Personal Todo List';
			if (selection !== 'All') {
				title += ` (Date: ${selection})`;
			}
			treeView.title = title;
		}
	}
}

// Polyfill for crypto.randomUUID
const Crypto = {
	randomUUID: () => {
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
			var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
			return v.toString(16);
		});
	}
};
