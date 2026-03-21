export interface ConnectionProfile {
    name: string;
    driver: string;
    host: string;
    port: number;
    db_name: string;
    username: string;
    password: string;
    ssl_mode?: string;
    connect_timeout: number;
    save_password: boolean;
    encrypt_password?: boolean;
    show_all_schemas: boolean;
    trust_server_cert: boolean;
}
