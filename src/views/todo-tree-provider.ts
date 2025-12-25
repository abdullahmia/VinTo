import { ITodo, TodoPriority, ViewMode } from '@/models';
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

	constructor(private storage: TodoStorageService) {}

	getTreeItem(element: TodoItem | TodoGroupItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: TodoItem | TodoGroupItem): Thenable<(TodoItem | TodoGroupItem)[]> {
		const todos = this.storage.getTodos();
		
		if (element instanceof TodoGroupItem) {
			return Promise.resolve(this.getGroupChildren(element, todos));
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

		filteredTodos = this.applyVisibilityFilter(filteredTodos);

		switch (this.viewMode) {
			case 'priority':
				return Promise.resolve(this.groupByPriority(filteredTodos));
			case 'status':
				return Promise.resolve(this.groupByStatus(filteredTodos));
			case 'date':
				return Promise.resolve(this.groupByDate(filteredTodos));
			case 'list':
			default:
				return Promise.resolve(filteredTodos.map(t => new TodoItem(t, vscode.TreeItemCollapsibleState.None)));
		}
	}

	private getGroupChildren(group: TodoGroupItem, allTodos: ITodo[]): TodoItem[] {
		let filtered = allTodos;
		
		if (this.searchQuery) {
			const query = this.searchQuery.toLowerCase();
			filtered = allTodos.filter(t => 
				t.title.toLowerCase().includes(query) || 
				(t.description && t.description.toLowerCase().includes(query))
			);
		}
		
		filtered = this.applyVisibilityFilter(filtered);

		if (group.contextValue === 'group-priority') {
			return filtered
				.filter(t => t.priority === group.label)
				.map(t => new TodoItem(t, vscode.TreeItemCollapsibleState.None));
		}
		
		if (group.contextValue === 'group-status') {
			const isCompleted = group.label === 'Completed';
			return filtered
				.filter(t => t.isCompleted === isCompleted)
				.map(t => new TodoItem(t, vscode.TreeItemCollapsibleState.None));
		}

		if (group.contextValue === 'group-date') {
			return this.getDateGroupChildren(group.label, filtered);
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

	private groupByStatus(todos: ITodo[]): TodoGroupItem[] {
		const completed = todos.filter(t => t.isCompleted);
		const pending = todos.filter(t => !t.isCompleted);

		return [
			new TodoGroupItem('Pending', pending.length, 'group-status'),
			new TodoGroupItem('Completed', completed.length, 'group-status')
		];
	}

	private groupByDate(todos: ITodo[]): TodoGroupItem[] {
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
			if (t.dueDate < todayStart && !t.isCompleted) { overdue++; }
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

	private getDateGroupChildren(label: string, todos: ITodo[]): TodoItem[] {
		const now = new Date();
		const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
		const tomorrowStart = todayStart + 86400000;
		const nextWeekEnd = todayStart + (7 * 86400000);

		let filtered: ITodo[] = [];
		switch (label) {
			case 'Overdue':
				filtered = todos.filter(t => t.dueDate && t.dueDate < todayStart && !t.isCompleted);
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
		return filtered.map(t => new TodoItem(t, vscode.TreeItemCollapsibleState.None));
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

	private applyVisibilityFilter(todos: ITodo[]): ITodo[] {
		switch (this.visibilityFilter) {
			case 'active':
				return todos.filter(t => !t.isCompleted);
			case 'high':
				return todos.filter(t => t.priority === TodoPriority.High);
			case 'all':
			default:
				return todos;
		}
	}
}
