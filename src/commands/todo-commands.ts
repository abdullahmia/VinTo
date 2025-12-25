import { ITodo, TodoPriority } from '@/models';
import { TodoItem, TodoTreeProvider } from '@/views';
import { TodoStorageService } from '@/services';
import { generateUUID } from '@/utils';
import * as vscode from 'vscode';
import { TodoDetailPanel, TodoPanel } from '@/views';

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
	const statuses = storage.getStatuses();
	const currentStatus = statuses.find(s => s.id === todo.status);

	let targetStatusId = todo.status;

	if (currentStatus?.type === 'completed') {
		// Switch to default active
		const defaultActive = statuses.find(s => s.type === 'active' && s.isDefault) || statuses.find(s => s.type === 'active');
		if (defaultActive) targetStatusId = defaultActive.id;
	} else {
		// Switch to default completed
		const defaultCompleted = statuses.find(s => s.type === 'completed' && s.isDefault) || statuses.find(s => s.type === 'completed');
		if (defaultCompleted) targetStatusId = defaultCompleted.id;
	}

	const updatedTodo: ITodo = {
		...todo,
		status: targetStatusId
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

export async function changeViewMode(provider: TodoTreeProvider, treeView: vscode.TreeView<TodoItem | import('@/views').TodoGroupItem>) {
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

export async function searchTodos(provider: TodoTreeProvider, treeView: vscode.TreeView<TodoItem | import('@/views').TodoGroupItem>) {
	const query = await vscode.window.showInputBox({
		placeHolder: 'Search todos...',
		prompt: 'Type to search by title or description'
	});

	if (query !== undefined) {
		provider.setSearchQuery(query);
		if (query) {
			treeView.message = `Results for "${query}"`;
			vscode.commands.executeCommand('setContext', 'personal-todo-list.isSearching', true);
		} else {
			treeView.message = undefined;
			vscode.commands.executeCommand('setContext', 'personal-todo-list.isSearching', false);
		}
	}
}

export async function clearSearch(provider: TodoTreeProvider, treeView: vscode.TreeView<TodoItem | import('@/views').TodoGroupItem>) {
	provider.setSearchQuery('');
	treeView.message = undefined;
	vscode.commands.executeCommand('setContext', 'personal-todo-list.isSearching', false);
}

export async function filterTodos(provider: TodoTreeProvider, treeView: vscode.TreeView<TodoItem | import('@/views').TodoGroupItem>) {
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

export async function setupProfile(extensionUri: vscode.Uri, profileService: import('@/services').UserProfileService) {
	const existingProfile = profileService.getProfile();
	const { UserOnboarding } = await import('@/views');
	UserOnboarding.createOrShow(extensionUri, profileService, existingProfile);
}

export async function viewProfile(
	extensionUri: vscode.Uri,
	profileService: import('@/services').UserProfileService,
	todoStorage: import('@/services').TodoStorageService
) {
	// Redirect to profile overview
	await showProfileOverview(extensionUri, profileService, todoStorage);
}

export async function showProfileOverview(
	extensionUri: vscode.Uri,
	profileService: import('@/services').UserProfileService,
	todoStorage: import('@/services').TodoStorageService
) {
	const { ProfileOverviewPanel } = await import('@/views');
	ProfileOverviewPanel.createOrShow(extensionUri, profileService, todoStorage);
}

export async function openSettings(
	extensionUri: vscode.Uri,
	profileService: import('@/services').UserProfileService,
	storage: import('@/services').TodoStorageService
) {
	const { SettingsPanel } = await import('@/views');
	SettingsPanel.createOrShow(extensionUri, profileService, storage);
}
