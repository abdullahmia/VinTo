import { ITodo, TodoPriority } from '@/models';
import { TodoItem, TodoTreeProvider } from '@/providers';
import { TodoStorageService } from '@/services';
import { generateUUID } from '@/utils';
import { TodoDetailPanel, TodoPanel } from '@/webviews';
import * as vscode from 'vscode';

export async function addTodo(extensionUri: vscode.Uri, storage: TodoStorageService, provider: TodoTreeProvider) {
	TodoPanel.createOrShow(extensionUri, storage, provider);
}

export async function openTodo(extensionUri: vscode.Uri, todo: ITodo, storage: TodoStorageService, provider: TodoTreeProvider) {
    TodoDetailPanel.createOrShow(extensionUri, todo, storage, provider);
}

export async function editTodo(extensionUri: vscode.Uri, item: TodoItem, storage: TodoStorageService, provider: TodoTreeProvider) {
    TodoPanel.createOrShow(extensionUri, storage, provider, item.todo);
}

export async function toggleTodo(item: TodoItem, storage: TodoStorageService, provider: TodoTreeProvider) {
	const todo = item.todo;
	const updatedTodo: ITodo = {
		...todo,
		isCompleted: !todo.isCompleted
	};
	await storage.updateTodo(updatedTodo);
	provider.refresh();
}

export async function setPriority(item: TodoItem, storage: TodoStorageService, provider: TodoTreeProvider, priority: TodoPriority) {
	if (!item) return;
	const updated = { ...item.todo, priority };
	await storage.updateTodo(updated);
	provider.refresh();
}

export async function setDueDate(item: TodoItem, storage: TodoStorageService, provider: TodoTreeProvider) {
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

export async function duplicateTodo(item: TodoItem, storage: TodoStorageService, provider: TodoTreeProvider) {
	if (!item) return;
	const original = item.todo;
	const newTodo: ITodo = {
		...original,
		id: generateUUID(),
		title: `${original.title} (Copy)`,
		createdAt: Date.now(),
	};
	
	await storage.addTodo(newTodo);
	provider.refresh();
}

export async function deleteTodo(item: TodoItem, storage: TodoStorageService, provider: TodoTreeProvider) {
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

export async function changeViewMode(provider: TodoTreeProvider, treeView: vscode.TreeView<TodoItem | import('@/providers').TodoGroupItem>) {
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

export async function searchTodos(provider: TodoTreeProvider, treeView: vscode.TreeView<TodoItem | import('@/providers').TodoGroupItem>) {
	const query = await vscode.window.showInputBox({
		placeHolder: 'Search todos...',
		prompt: 'Type to search by title or description'
	});

	if (query !== undefined) { 
		provider.setSearchQuery(query);
		if (query) {
			treeView.message = `Results for "${query}"`;
		} else {
			treeView.message = undefined; 
		}
	}
}

export async function clearSearch(provider: TodoTreeProvider, treeView: vscode.TreeView<TodoItem | import('@/providers').TodoGroupItem>) {
	provider.setSearchQuery('');
	treeView.message = undefined; 
}

export async function filterTodos(provider: TodoTreeProvider, treeView: vscode.TreeView<TodoItem | import('@/providers').TodoGroupItem>) {
	const options = ['Show All', 'Hide Completed', 'Show Only High Priority'];
	const selection = await vscode.window.showQuickPick(options, {
		placeHolder: 'Select Filter'
	});

	if (selection) {
		if (selection === 'Show All') {
			provider.setVisibilityFilter({ savedFilter: 'all' });
		} else if (selection === 'Hide Completed') {
			provider.setVisibilityFilter({ savedFilter: 'active' });
		} else if (selection === 'Show Only High Priority') {
			provider.setVisibilityFilter({ savedFilter: 'high' });
		}
	}
}
