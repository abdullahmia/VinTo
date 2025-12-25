export enum TodoPriority {
	High = 'high',
	Medium = 'medium',
	Low = 'low'
}

export interface ITodo {
	id: string;
	title: string;
	description?: string;
	status: string; // Corresponds to ITodoStatus.id
	priority: TodoPriority;
	createdAt: number;
	dueDate?: number;
	tags?: string[];
	focusSessions?: string[]; // Array of focus session IDs
	totalFocusTime?: number; // Total time spent in focus mode (milliseconds)
	activeFocusSessionId?: string; // Currently active session ID (if any)
}
