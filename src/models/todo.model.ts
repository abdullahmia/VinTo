export enum TodoPriority {
	High = 'high',
	Medium = 'medium',
	Low = 'low'
}

export interface ITodo {
	id: string;
	title: string;
	description?: string;
	isCompleted: boolean;
	priority: TodoPriority;
	createdAt: number;
	dueDate?: number;
	tags?: string[];
}
