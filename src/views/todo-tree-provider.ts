import { ITodo, TodoPriority, ViewMode, ITodoStatus } from '@/models';
import { TodoStorageService } from '@/services';
import * as vscode from 'vscode';
import { TodoGroupItem } from './items/todo-group-item';
import { TodoItem } from './items/todo-item';

export class TodoTreeProvider implements vscode.TreeDataProvider<TodoItem | TodoGroupItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<TodoItem | TodoGroupItem | undefined | null | void> = new vscode.EventEmitter<TodoItem | TodoGroupItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<TodoItem | TodoGroupItem | undefined | null | void> = this._onDidChangeTreeData.event;

	private viewMode: ViewMode = 'status';
	private searchQuery: string = '';
	private visibilityFilter: 'all' | 'active' | 'high' = 'all';

	constructor(private storage: TodoStorageService) {
		this.storage.onDidChangeStatuses(() => this.refresh());
	}

	getTreeItem(element: TodoItem | TodoGroupItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: TodoItem | TodoGroupItem): Thenable<(TodoItem | TodoGroupItem)[]> {
		const todos = this.storage.getTodos();
		const statuses = this.storage.getStatuses();

		if (element instanceof TodoGroupItem) {
			return Promise.resolve(this.getGroupChildren(element, todos, statuses));
		}

		if (element instanceof TodoItem) {
			return Promise.resolve([]);
		}

		let filteredTodos = todos;

		if (this.searchQuery) {
			const query = this.searchQuery.toLowerCase();
			filteredTodos = todos.filter(t =>
				t.title.toLowerCase().includes(query) ||
				(t.description && t.description.toLowerCase().includes(query))
			);
		}

		filteredTodos = this.applyVisibilityFilter(filteredTodos, statuses);

		switch (this.viewMode) {
			case 'priority':
				return Promise.resolve(this.groupByPriority(filteredTodos));
			case 'status':
				return Promise.resolve(this.groupByStatus(filteredTodos, statuses));
			case 'date':
				return Promise.resolve(this.groupByDate(filteredTodos, statuses));
			case 'list':
			default:
				return Promise.resolve(filteredTodos.map(t => {
					const status = statuses.find(s => s.id === t.status);
					return new TodoItem(t, vscode.TreeItemCollapsibleState.None, status);
				}));
		}
	}

	private getGroupChildren(group: TodoGroupItem, allTodos: ITodo[], statuses: ITodoStatus[]): TodoItem[] {
		let filtered = allTodos;

		if (this.searchQuery) {
			const query = this.searchQuery.toLowerCase();
			filtered = allTodos.filter(t =>
				t.title.toLowerCase().includes(query) ||
				(t.description && t.description.toLowerCase().includes(query))
			);
		}

		filtered = this.applyVisibilityFilter(filtered, statuses);

		if (group.contextValue === 'group-priority') {
			return filtered
				.filter(t => t.priority === group.label)
				.map(t => {
					const status = statuses.find(s => s.id === t.status);
					return new TodoItem(t, vscode.TreeItemCollapsibleState.None, status);
				});
		}

		if (group.contextValue === 'group-status') {
			// Find the status ID corresponding to this group label
			// This is a bit loose, ideally TodoGroupItem would hold the ID.
			// But for now, let's assume labels are unique enough or we pass ID in constructor if we change signature.
			// Actually, let's look up by label.
			const status = statuses.find(s => s.label === group.label);
			if (status) {
				return filtered
					.filter(t => t.status === status.id)
					.map(t => new TodoItem(t, vscode.TreeItemCollapsibleState.None, status));
			}
			return [];
		}

		if (group.contextValue === 'group-date') {
			return this.getDateGroupChildren(group.label, filtered, statuses);
		}

		return [];
	}

	private groupByPriority(todos: ITodo[]): TodoGroupItem[] {
		const high = todos.filter(t => t.priority === TodoPriority.High);
		const medium = todos.filter(t => t.priority === TodoPriority.Medium);
		const low = todos.filter(t => t.priority === TodoPriority.Low);

		const groups: TodoGroupItem[] = [];
		if (high.length > 0) { groups.push(new TodoGroupItem(TodoPriority.High, high.length, 'group-priority')); }
		if (medium.length > 0) { groups.push(new TodoGroupItem(TodoPriority.Medium, medium.length, 'group-priority')); }
		if (low.length > 0) { groups.push(new TodoGroupItem(TodoPriority.Low, low.length, 'group-priority')); }

		return groups;
	}

	private groupByStatus(todos: ITodo[], statuses: ITodoStatus[]): TodoGroupItem[] {
		const groups: TodoGroupItem[] = [];

		// Create a group for each configured status
		statuses.forEach(status => {
			const count = todos.filter(t => t.status === status.id).length;
			// Only show groups with items or maybe always show (ignoring consistency with other views for now, let's hide empty)
			// Actually, "User can add their own status" -> likely want to see the bucket even if empty?
			// Let's stick to existing pattern: hide empty.
			// Always show groups for configured statuses
			groups.push(new TodoGroupItem(status.label, count, 'group-status'));
		});

		// Fallback for todos with unknown statuses (orphaned)
		const unknown = todos.filter(t => !statuses.find(s => s.id === t.status));
		if (unknown.length > 0) {
			groups.push(new TodoGroupItem('Unknown', unknown.length, 'group-status'));
		}

		return groups;
	}

	private groupByDate(todos: ITodo[], statuses: ITodoStatus[]): TodoGroupItem[] {
		const now = new Date();
		const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
		const tomorrowStart = todayStart + 86400000;
		const nextWeekEnd = todayStart + (7 * 86400000);

		let overdue = 0;
		let today = 0;
		let thisWeek = 0;
		let later = 0;
		let noDate = 0;

		todos.forEach(t => {
			if (!t.dueDate) {
				noDate++;
				return;
			}

			// Check if completed based on status type
			const status = statuses.find(s => s.id === t.status);
			const isCompleted = status ? status.type === 'completed' : false;

			if (t.dueDate < todayStart && !isCompleted) { overdue++; }
			else if (t.dueDate >= todayStart && t.dueDate < tomorrowStart) { today++; }
			else if (t.dueDate >= tomorrowStart && t.dueDate < nextWeekEnd) { thisWeek++; }
			else { later++; }
		});

		const groups: TodoGroupItem[] = [];
		if (overdue > 0) { groups.push(new TodoGroupItem('Overdue', overdue, 'group-date')); }
		if (today > 0) { groups.push(new TodoGroupItem('Today', today, 'group-date')); }
		if (thisWeek > 0) { groups.push(new TodoGroupItem('This Week', thisWeek, 'group-date')); }
		if (later > 0) { groups.push(new TodoGroupItem('Later', later, 'group-date')); }
		if (noDate > 0) { groups.push(new TodoGroupItem('No Date', noDate, 'group-date')); }

		return groups;
	}

	private getDateGroupChildren(label: string, todos: ITodo[], statuses: ITodoStatus[]): TodoItem[] {
		const now = new Date();
		const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
		const tomorrowStart = todayStart + 86400000;
		const nextWeekEnd = todayStart + (7 * 86400000);

		const isNotCompleted = (t: ITodo) => {
			const status = statuses.find(s => s.id === t.status);
			return status ? status.type !== 'completed' : true;
		};

		let filtered: ITodo[] = [];
		switch (label) {
			case 'Overdue':
				filtered = todos.filter(t => t.dueDate && t.dueDate < todayStart && isNotCompleted(t));
				break;
			case 'Today':
				filtered = todos.filter(t => t.dueDate && t.dueDate >= todayStart && t.dueDate < tomorrowStart);
				break;
			case 'This Week':
				filtered = todos.filter(t => t.dueDate && t.dueDate >= tomorrowStart && t.dueDate < nextWeekEnd);
				break;
			case 'Later':
				filtered = todos.filter(t => t.dueDate && t.dueDate >= nextWeekEnd);
				break;
			case 'No Date':
				filtered = todos.filter(t => !t.dueDate);
				break;
		}
		return filtered.map(t => {
			const status = statuses.find(s => s.id === t.status);
			return new TodoItem(t, vscode.TreeItemCollapsibleState.None, status);
		});
	}

	setViewMode(mode: ViewMode) {
		this.viewMode = mode;
		this.refresh();
	}

	setSearchQuery(query: string) {
		this.searchQuery = query;
		this.refresh();
	}

	setVisibilityFilter(filter: { savedFilter: 'all' | 'active' | 'high' }) {
		this.visibilityFilter = filter.savedFilter;
		this.refresh();
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	private applyVisibilityFilter(todos: ITodo[], statuses: ITodoStatus[]): ITodo[] {
		switch (this.visibilityFilter) {
			case 'active':
				return todos.filter(t => {
					const status = statuses.find(s => s.id === t.status);
					return status ? status.type === 'active' : true;
				});
			case 'high':
				return todos.filter(t => t.priority === TodoPriority.High);
			case 'all':
			default:
				return todos;
		}
	}
}
