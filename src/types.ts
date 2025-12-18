export type ViewMode = 'list' | 'priority' | 'status' | 'date';

export type SortOption = 'priority' | 'date' | 'title';

export interface ViewSettings {
    mode: ViewMode;
    sort: SortOption;
    showCompleted: boolean;
}
