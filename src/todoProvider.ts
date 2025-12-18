import * as vscode from 'vscode';
import { Todo, TodoPriority } from './todo';
import { TodoItem } from './todoItem';
import { TodoStorage } from './todoStorage';

export class TodoTreeDataProvider implements vscode.TreeDataProvider<TodoItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<TodoItem | undefined | null | void> = new vscode.EventEmitter<TodoItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<TodoItem | undefined | null | void> = this._onDidChangeTreeData.event;

	private filter: TodoPriority | 'All' = 'All';
	private dateFilter: 'All' | 'Today' | 'Week' | 'Overdue' | { custom: number } = 'All';

	constructor(private storage: TodoStorage) {}

	getTreeItem(element: TodoItem): vscode.TreeItem {
		return element;
	}

	setFilter(filter: TodoPriority | 'All') {
		this.filter = filter;
		this.refresh();
	}

	setDateFilter(filter: 'All' | 'Today' | 'Week' | 'Overdue' | { custom: number }) {
		this.dateFilter = filter;
		this.refresh();
	}

	getChildren(element?: TodoItem): Thenable<TodoItem[]> {
		if (element) {
			return Promise.resolve([]);
		} else {
			let todos = this.storage.getTodos();
			
			// Priority Filter
			if (this.filter !== 'All') {
				todos = todos.filter(t => t.priority === this.filter);
			}

			// Date Filter
			if (this.dateFilter !== 'All') {
				const now = new Date();
				const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
				const tomorrowStart = todayStart + 86400000;
				const nextWeekEnd = todayStart + (7 * 86400000);

				todos = todos.filter(t => {
					if (!t.dueDate) { return false; }
					
					if (this.dateFilter === 'Overdue') {
						return t.dueDate < todayStart;
					} else if (this.dateFilter === 'Today') {
						return t.dueDate >= todayStart && t.dueDate < tomorrowStart;
					} else if (this.dateFilter === 'Week') {
						return t.dueDate >= todayStart && t.dueDate < nextWeekEnd;
					} else if (typeof this.dateFilter === 'object' && 'custom' in this.dateFilter) {
						// Match specific date
						const customDate = new Date(this.dateFilter.custom);
						const customStart = new Date(customDate.getFullYear(), customDate.getMonth(), customDate.getDate()).getTime();
						const customEnd = customStart + 86400000;
						return t.dueDate >= customStart && t.dueDate < customEnd;
					}
					return true;
				});
			}

			// Sort by priority (High < Medium < Low) or Created Date
			return Promise.resolve(todos.map(todo => new TodoItem(todo, vscode.TreeItemCollapsibleState.None)));
		}
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	private seedData() {
		const dummyTodos: Todo[] = [
			{
				id: '1',
				title: 'Finish the report',
				priority: TodoPriority.High,
				isCompleted: false,
				createdAt: Date.now()
			},
			{
				id: '2',
				title: 'Email the team',
				priority: TodoPriority.Medium,
				isCompleted: false,
				createdAt: Date.now()
			},
			{
				id: '3',
				title: 'Buy groceries',
				priority: TodoPriority.Low,
				isCompleted: false,
				createdAt: Date.now()
			}
		];
		this.storage.saveTodos(dummyTodos);
	}
}
