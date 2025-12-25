export interface ITodoStatus {
    id: string;
    label: string;
    color: string; // Hex code or predefined color name
    type: 'active' | 'completed';
    isDefault?: boolean;
}

export interface ISettings {
    todoStatuses: ITodoStatus[];
}

export const DEFAULT_STATUSES: ITodoStatus[] = [
    { id: 'pending', label: 'Pending', color: '#ffcc00', type: 'active', isDefault: true },
    { id: 'in-progress', label: 'In Progress', color: '#3399ff', type: 'active' },
    { id: 'completed', label: 'Completed', color: '#66ff66', type: 'completed' }
];
