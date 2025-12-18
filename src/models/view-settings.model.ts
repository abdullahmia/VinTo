export type ViewMode = 'list' | 'priority' | 'status' | 'date';

export type SortOption = 'priority' | 'date' | 'title';

export interface IViewSettings {
    mode: ViewMode;
    sort: SortOption;
    showCompleted: boolean;
}
