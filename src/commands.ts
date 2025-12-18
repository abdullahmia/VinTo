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

export async function setPriority(item: TodoItem, storage: TodoStorage, provider: TodoTreeDataProvider, priority: TodoPriority) {
	if (!item) return;
	const updated = { ...item.todo, priority };
	await storage.updateTodo(updated);
	provider.refresh();
}

export async function setDueDate(item: TodoItem, storage: TodoStorage, provider: TodoTreeDataProvider) {
	if (!item) return;
	const dateString = await vscode.window.showInputBox({
		prompt: 'Set Due Date (YYYY-MM-DD)',
		value: item.todo.dueDate ? new Date(item.todo.dueDate).toISOString().split('T')[0] : '',
		placeHolder: 'YYYY-MM-DD'
	});

	if (dateString !== undefined) {
		const todo = item.todo;
		let dueDate: number | undefined;
		
		if (dateString.trim()) {
			const parsed = Date.parse(dateString);
			if (isNaN(parsed)) {
				vscode.window.showErrorMessage('Invalid Date Format');
				return;
			}
			dueDate = parsed;
		}

		await storage.updateTodo({ ...todo, dueDate });
		provider.refresh();
	}
}

export async function duplicateTodo(item: TodoItem, storage: TodoStorage, provider: TodoTreeDataProvider) {
	if (!item) return;
	const original = item.todo;
	const newTodo: Todo = {
		...original,
		id: Crypto.randomUUID(),
		title: `${original.title} (Copy)`,
		createdAt: Date.now(),
		// Keep other properties same
	};
	
	// Create a slightly better way to generate ID if we can, or rely on storage.addTodo if it generates IDs?
	// Storage.addTodo currently takes a Todo object.
	// We need to generate ID manually here as per current storage implementation expectation or modify storage.
	// Looking at previous todoProvider, it was manually generating IDs in seedData, so I assume we generate it.
	
	await storage.addTodo(newTodo);
	provider.refresh();
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

export async function changeViewMode(provider: TodoTreeDataProvider, treeView: vscode.TreeView<TodoItem | import('./todoGroupItem').TodoGroupItem>) {
	const modes = [
		{ label: 'List View (All Todos)', description: 'Flat list of all todos', mode: 'list' },
		{ label: 'Group by Priority', description: 'High, Medium, Low', mode: 'priority' },
		{ label: 'Group by Status', description: 'Pending, Completed', mode: 'status' },
		{ label: 'Group by Date', description: 'Overdue, Today, This Week', mode: 'date' }
	];

	const selected = await vscode.window.showQuickPick(modes, {
		placeHolder: 'Select View Mode'
	});

	if (selected) {
		provider.setViewMode(selected.mode as any);
		treeView.title = `Todo List: ${selected.label}`;
	}
}

export async function searchTodos(provider: TodoTreeDataProvider, treeView: vscode.TreeView<TodoItem | import('./todoGroupItem').TodoGroupItem>) {
	const query = await vscode.window.showInputBox({
		placeHolder: 'Search todos...',
		prompt: 'Type to search by title or description'
	});

	if (query !== undefined) { // Allow empty string to clear
		provider.setSearchQuery(query);
		if (query) {
			treeView.message = `Results for "${query}"`;
		} else {
			treeView.message = undefined; 
		}
	}
}

export async function clearSearch(provider: TodoTreeDataProvider, treeView: vscode.TreeView<TodoItem | import('./todoGroupItem').TodoGroupItem>) {
	provider.setSearchQuery('');
	treeView.message = undefined; 
}

export async function filterTodos(provider: TodoTreeDataProvider, treeView: vscode.TreeView<TodoItem | import('./todoGroupItem').TodoGroupItem>) {
	const options = ['Show All', 'Hide Completed', 'Show Only High Priority'];
	const selection = await vscode.window.showQuickPick(options, {
		placeHolder: 'Select Filter'
	});

	if (selection) {
		// Ideally we would integrate this with provider.setFilter, but for now let's implement a simple version or reuse existing logic if possible.
		// Detailed implementation path: Add setVisibilityFilter method to provider.
		
		if (selection === 'Show All') {
			provider.setVisibilityFilter({ savedFilter: 'all' });
		} else if (selection === 'Hide Completed') {
			provider.setVisibilityFilter({ savedFilter: 'active' });
		} else if (selection === 'Show Only High Priority') {
			provider.setVisibilityFilter({ savedFilter: 'high' });
		}
	}
}
