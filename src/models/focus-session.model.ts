export interface IFocusSession {
	id: string;
	todoId: string;
	startTime: number;
	endTime?: number;
	duration: number; // Planned duration in milliseconds
	actualDuration?: number; // Actual time spent in milliseconds
	completed: boolean; // Whether session finished normally or was interrupted
	zenModeEnabled: boolean;
}

export interface IActiveFocusSession extends IFocusSession {
	remainingTime: number; // Remaining time in milliseconds
	elapsedTime: number; // Elapsed time in milliseconds
}
