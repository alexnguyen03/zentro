export namespace app {
	
	export class ConnectionRuntimeState {
	    profile?: models.ConnectionProfile;
	    status: string;
	
	    static createFrom(source: any = {}) {
	        return new ConnectionRuntimeState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.profile = this.convertValues(source["profile"], models.ConnectionProfile);
	        this.status = source["status"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ExecutionPolicy {
	    timeout_seconds: number;
	    row_cap_per_tab: number;
	    destructive_rules: string;
	    environment_strictness: string;
	
	    static createFrom(source: any = {}) {
	        return new ExecutionPolicy(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.timeout_seconds = source["timeout_seconds"];
	        this.row_cap_per_tab = source["row_cap_per_tab"];
	        this.destructive_rules = source["destructive_rules"];
	        this.environment_strictness = source["environment_strictness"];
	    }
	}
	export class IndexInfo {
	    Name: string;
	    Table: string;
	    Columns: string[];
	    Unique: boolean;
	
	    static createFrom(source: any = {}) {
	        return new IndexInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Name = source["Name"];
	        this.Table = source["Table"];
	        this.Columns = source["Columns"];
	        this.Unique = source["Unique"];
	    }
	}
	export class UpdateInfo {
	    latest_version: string;
	    release_url: string;
	    changelog: string;
	    has_update: boolean;
	
	    static createFrom(source: any = {}) {
	        return new UpdateInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.latest_version = source["latest_version"];
	        this.release_url = source["release_url"];
	        this.changelog = source["changelog"];
	        this.has_update = source["has_update"];
	    }
	}

}

export namespace core {
	
	export class DriverDescriptor {
	    name: string;
	    capabilities: string[];
	
	    static createFrom(source: any = {}) {
	        return new DriverDescriptor(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.capabilities = source["capabilities"];
	    }
	}

}

export namespace license {
	
	export class Entitlement {
	    feature_id: string;
	    enabled: boolean;
	    limit?: number;
	
	    static createFrom(source: any = {}) {
	        return new Entitlement(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.feature_id = source["feature_id"];
	        this.enabled = source["enabled"];
	        this.limit = source["limit"];
	    }
	}
	export class Policy {
	    require_online_refresh: boolean;
	    refresh_interval_minute: number;
	
	    static createFrom(source: any = {}) {
	        return new Policy(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.require_online_refresh = source["require_online_refresh"];
	        this.refresh_interval_minute = source["refresh_interval_minute"];
	    }
	}
	export class State {
	    status: string;
	    masked_key?: string;
	    session_token?: string;
	    // Go type: time
	    expires_at?: any;
	    entitlements: Entitlement[];
	    policy: Policy;
	    last_error?: string;
	
	    static createFrom(source: any = {}) {
	        return new State(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.status = source["status"];
	        this.masked_key = source["masked_key"];
	        this.session_token = source["session_token"];
	        this.expires_at = this.convertValues(source["expires_at"], null);
	        this.entitlements = this.convertValues(source["entitlements"], Entitlement);
	        this.policy = this.convertValues(source["policy"], Policy);
	        this.last_error = source["last_error"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace models {
	
	export class Bookmark {
	    id: string;
	    line: number;
	    label?: string;
	    // Go type: time
	    created_at: any;
	
	    static createFrom(source: any = {}) {
	        return new Bookmark(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.line = source["line"];
	        this.label = source["label"];
	        this.created_at = this.convertValues(source["created_at"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ColumnDef {
	    Name: string;
	    DataType: string;
	    IsPrimaryKey: boolean;
	    IsNullable: boolean;
	    DefaultValue: string;
	
	    static createFrom(source: any = {}) {
	        return new ColumnDef(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Name = source["Name"];
	        this.DataType = source["DataType"];
	        this.IsPrimaryKey = source["IsPrimaryKey"];
	        this.IsNullable = source["IsNullable"];
	        this.DefaultValue = source["DefaultValue"];
	    }
	}
	export class ConnectionProfile {
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
	    encrypt_password: boolean;
	    show_all_schemas: boolean;
	    trust_server_cert: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ConnectionProfile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.driver = source["driver"];
	        this.host = source["host"];
	        this.port = source["port"];
	        this.db_name = source["db_name"];
	        this.username = source["username"];
	        this.password = source["password"];
	        this.ssl_mode = source["ssl_mode"];
	        this.connect_timeout = source["connect_timeout"];
	        this.save_password = source["save_password"];
	        this.encrypt_password = source["encrypt_password"];
	        this.show_all_schemas = source["show_all_schemas"];
	        this.trust_server_cert = source["trust_server_cert"];
	    }
	}
	export class HistoryEntry {
	    id: string;
	    query: string;
	    profile: string;
	    database: string;
	    duration_ms: number;
	    row_count: number;
	    error?: string;
	    executed_at: string;
	
	    static createFrom(source: any = {}) {
	        return new HistoryEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.query = source["query"];
	        this.profile = source["profile"];
	        this.database = source["database"];
	        this.duration_ms = source["duration_ms"];
	        this.row_count = source["row_count"];
	        this.error = source["error"];
	        this.executed_at = source["executed_at"];
	    }
	}
	export class ProjectAsset {
	    id: string;
	    project_id: string;
	    type: string;
	    name: string;
	    description?: string;
	    tags?: string[];
	    created_at: string;
	    updated_at: string;
	
	    static createFrom(source: any = {}) {
	        return new ProjectAsset(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.project_id = source["project_id"];
	        this.type = source["type"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.tags = source["tags"];
	        this.created_at = source["created_at"];
	        this.updated_at = source["updated_at"];
	    }
	}
	export class ProjectConnection {
	    id: string;
	    project_id: string;
	    environment_key: string;
	    name: string;
	    driver: string;
	    version?: string;
	    host?: string;
	    port?: number;
	    database?: string;
	    username?: string;
	    password?: string;
	    password_policy?: string;
	    save_password: boolean;
	    ssl_mode?: string;
	    socket_path?: string;
	    use_socket: boolean;
	    ssh_enabled: boolean;
	    status_color?: string;
	    advanced_meta?: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new ProjectConnection(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.project_id = source["project_id"];
	        this.environment_key = source["environment_key"];
	        this.name = source["name"];
	        this.driver = source["driver"];
	        this.version = source["version"];
	        this.host = source["host"];
	        this.port = source["port"];
	        this.database = source["database"];
	        this.username = source["username"];
	        this.password = source["password"];
	        this.password_policy = source["password_policy"];
	        this.save_password = source["save_password"];
	        this.ssl_mode = source["ssl_mode"];
	        this.socket_path = source["socket_path"];
	        this.use_socket = source["use_socket"];
	        this.ssh_enabled = source["ssh_enabled"];
	        this.status_color = source["status_color"];
	        this.advanced_meta = source["advanced_meta"];
	    }
	}
	export class ProjectEnvironment {
	    id: string;
	    project_id: string;
	    key: string;
	    label: string;
	    badge_color?: string;
	    is_protected: boolean;
	    is_read_only: boolean;
	    last_database?: string;
	    last_schema?: string;
	    last_catalog?: string;
	    connection_id?: string;
	
	    static createFrom(source: any = {}) {
	        return new ProjectEnvironment(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.project_id = source["project_id"];
	        this.key = source["key"];
	        this.label = source["label"];
	        this.badge_color = source["badge_color"];
	        this.is_protected = source["is_protected"];
	        this.is_read_only = source["is_read_only"];
	        this.last_database = source["last_database"];
	        this.last_schema = source["last_schema"];
	        this.last_catalog = source["last_catalog"];
	        this.connection_id = source["connection_id"];
	    }
	}
	export class Project {
	    id: string;
	    slug: string;
	    name: string;
	    description?: string;
	    storage_path?: string;
	    tags?: string[];
	    created_at: string;
	    updated_at: string;
	    default_environment_key: string;
	    layout_state?: string;
	    environments?: ProjectEnvironment[];
	    connections?: ProjectConnection[];
	    assets?: ProjectAsset[];
	
	    static createFrom(source: any = {}) {
	        return new Project(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.slug = source["slug"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.storage_path = source["storage_path"];
	        this.tags = source["tags"];
	        this.created_at = source["created_at"];
	        this.updated_at = source["updated_at"];
	        this.default_environment_key = source["default_environment_key"];
	        this.layout_state = source["layout_state"];
	        this.environments = this.convertValues(source["environments"], ProjectEnvironment);
	        this.connections = this.convertValues(source["connections"], ProjectConnection);
	        this.assets = this.convertValues(source["assets"], ProjectAsset);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	
	export class SavedScript {
	    id: string;
	    project_id: string;
	    connection_name: string;
	    name: string;
	    created_at: string;
	    updated_at: string;
	
	    static createFrom(source: any = {}) {
	        return new SavedScript(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.project_id = source["project_id"];
	        this.connection_name = source["connection_name"];
	        this.name = source["name"];
	        this.created_at = source["created_at"];
	        this.updated_at = source["updated_at"];
	    }
	}
	export class TableRelationship {
	    ConstraintName: string;
	    SourceSchema: string;
	    SourceTable: string;
	    SourceColumn: string;
	    TargetSchema: string;
	    TargetTable: string;
	    TargetColumn: string;
	
	    static createFrom(source: any = {}) {
	        return new TableRelationship(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ConstraintName = source["ConstraintName"];
	        this.SourceSchema = source["SourceSchema"];
	        this.SourceTable = source["SourceTable"];
	        this.SourceColumn = source["SourceColumn"];
	        this.TargetSchema = source["TargetSchema"];
	        this.TargetTable = source["TargetTable"];
	        this.TargetColumn = source["TargetColumn"];
	    }
	}
	export class Template {
	    id: string;
	    name: string;
	    trigger: string;
	    content: string;
	
	    static createFrom(source: any = {}) {
	        return new Template(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.trigger = source["trigger"];
	        this.content = source["content"];
	    }
	}

}

export namespace plugin {
	
	export class CommandContribution {
	    id: string;
	    title: string;
	    handler_key: string;
	
	    static createFrom(source: any = {}) {
	        return new CommandContribution(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.handler_key = source["handler_key"];
	    }
	}
	export class DataProviderContribution {
	    id: string;
	    resource_types: string[];
	    query_hook: string;
	
	    static createFrom(source: any = {}) {
	        return new DataProviderContribution(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.resource_types = source["resource_types"];
	        this.query_hook = source["query_hook"];
	    }
	}
	export class Manifest {
	    id: string;
	    version: string;
	    min_app_version: string;
	    capabilities: string[];
	
	    static createFrom(source: any = {}) {
	        return new Manifest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.version = source["version"];
	        this.min_app_version = source["min_app_version"];
	        this.capabilities = source["capabilities"];
	    }
	}
	export class Contribution {
	    manifest: Manifest;
	    commands?: CommandContribution[];
	    data_providers?: DataProviderContribution[];
	    metadata?: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new Contribution(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.manifest = this.convertValues(source["manifest"], Manifest);
	        this.commands = this.convertValues(source["commands"], CommandContribution);
	        this.data_providers = this.convertValues(source["data_providers"], DataProviderContribution);
	        this.metadata = source["metadata"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	

}

export namespace utils {
	
	export class Preferences {
	    theme: string;
	    font_size: number;
	    default_limit: number;
	    chunk_size: number;
	    toast_placement: string;
	    query_timeout: number;
	    connect_timeout: number;
	    schema_timeout: number;
	    auto_check_updates: boolean;
	    view_mode: boolean;
	    shortcuts: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new Preferences(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.theme = source["theme"];
	        this.font_size = source["font_size"];
	        this.default_limit = source["default_limit"];
	        this.chunk_size = source["chunk_size"];
	        this.toast_placement = source["toast_placement"];
	        this.query_timeout = source["query_timeout"];
	        this.connect_timeout = source["connect_timeout"];
	        this.schema_timeout = source["schema_timeout"];
	        this.auto_check_updates = source["auto_check_updates"];
	        this.view_mode = source["view_mode"];
	        this.shortcuts = source["shortcuts"];
	    }
	}

}

