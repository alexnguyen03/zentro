export interface QueryFeatureApi {
    execute(tabId: string, sql: string): Promise<void>;
    explain(tabId: string, sql: string, analyze: boolean): Promise<void>;
    cancel(tabId: string): Promise<void>;
}

export interface QueryCommandContext {
    tabId: string;
    sql: string;
}

export interface QueryCommandContribution {
    id: string;
    title: string;
    run(context: QueryCommandContext): void | Promise<void>;
    isAvailable?(context: QueryCommandContext): boolean;
}

export interface ResultActionContext {
    tabId: string;
    rowCount: number;
    columnCount: number;
}

export interface ResultActionContribution {
    id: string;
    title: string;
    run(context: ResultActionContext): void | Promise<void>;
    isAvailable?(context: ResultActionContext): boolean;
}
