export interface QueryFeatureApi {
    execute(tabId: string, sql: string): Promise<void>;
    explain(tabId: string, sql: string, analyze: boolean): Promise<void>;
    cancel(tabId: string): Promise<void>;
}

