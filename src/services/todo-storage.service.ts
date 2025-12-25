import { ITodo, ITodoStatus, DEFAULT_STATUSES } from '@/models';
import * as vscode from 'vscode';

export class TodoStorageService {
	private static readonly KEY = 'personal-todo-list.todos';
	private static readonly STATUS_KEY = 'personal-todo-list.statuses';

	private _onDidChangeStatuses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
	readonly onDidChangeStatuses: vscode.Event<void> = this._onDidChangeStatuses.event;

	constructor(private context: vscode.ExtensionContext) {
		this._migrateTodos();
	}

	getTodos(): ITodo[] {
		return this.context.globalState.get<ITodo[]>(TodoStorageService.KEY, []);
	}

	getStatuses(): ITodoStatus[] {
		return this.context.globalState.get<ITodoStatus[]>(TodoStorageService.STATUS_KEY, DEFAULT_STATUSES);
	}

	async saveTodos(todos: ITodo[]): Promise<void> {
		await this.context.globalState.update(TodoStorageService.KEY, todos);
	}

	async saveStatuses(statuses: ITodoStatus[]): Promise<void> {
		await this.context.globalState.update(TodoStorageService.STATUS_KEY, statuses);
		this._onDidChangeStatuses.fire();
	}

	async addTodo(todo: ITodo): Promise<void> {
		const todos = this.getTodos();
		todos.push(todo);
		await this.saveTodos(todos);
	}

	async updateTodo(updatedTodo: ITodo): Promise<void> {
		const todos = this.getTodos();
		const index = todos.findIndex(t => t.id === updatedTodo.id);
		if (index !== -1) {
			todos[index] = updatedTodo;
			await this.saveTodos(todos);
		}
	}

	async deleteTodo(id: string): Promise<void> {
		const todos = this.getTodos();
		const newTodos = todos.filter(t => t.id !== id);
		await this.saveTodos(newTodos);
	}

	private async _migrateTodos() {
		const todos: any[] = this.getTodos();
		let hasChanges = false;
		const statuses = this.getStatuses();
		const pendingId = statuses.find(s => s.isDefault && s.type === 'active')?.id || 'pending';
		const completedId = statuses.find(s => s.type === 'completed')?.id || 'completed';

		const migratedTodos = todos.map(t => {
			if (typeof t.isCompleted !== 'undefined') {
				hasChanges = true;
				const newTodo = { ...t, status: t.isCompleted ? completedId : pendingId };
				delete newTodo.isCompleted;
				return newTodo;
			}
			return t;
		});

		if (hasChanges) {
			await this.saveTodos(migratedTodos);
		}
	}
}
