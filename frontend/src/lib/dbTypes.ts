import { DRIVER } from './constants';

// Database-specific column types for autocomplete in TableInfo editor
export const DB_TYPES: Record<string, string[]> = {
    [DRIVER.SQLSERVER]: [
        'int', 'bigint', 'smallint', 'tinyint', 'bit',
        'decimal', 'numeric', 'float', 'real', 'money', 'smallmoney',
        'char', 'varchar', 'nchar', 'nvarchar', 'text', 'ntext',
        'varchar(max)', 'nvarchar(max)', 'nvarchar(50)', 'nvarchar(100)', 'nvarchar(255)',
        'varchar(50)', 'varchar(100)', 'varchar(255)',
        'date', 'time', 'datetime', 'datetime2', 'smalldatetime', 'datetimeoffset',
        'binary', 'varbinary', 'varbinary(max)', 'image',
        'uniqueidentifier', 'xml', 'sql_variant', 'timestamp', 'rowversion',
    ],
    [DRIVER.POSTGRES]: [
        'integer', 'bigint', 'smallint', 'serial', 'bigserial', 'smallserial',
        'numeric', 'decimal', 'real', 'double precision', 'money',
        'boolean',
        'char', 'varchar', 'text', 'character varying',
        'varchar(50)', 'varchar(100)', 'varchar(255)', 'varchar(500)',
        'date', 'time', 'timestamp', 'timestamptz', 'interval',
        'uuid', 'json', 'jsonb', 'xml',
        'bytea', 'bit', 'varbit',
        'cidr', 'inet', 'macaddr',
        'int2', 'int4', 'int8', 'float4', 'float8',
        'tsvector', 'tsquery',
    ],
    [DRIVER.MYSQL]: [
        'int', 'bigint', 'mediumint', 'smallint', 'tinyint',
        'decimal', 'float', 'double', 'numeric', 'bit',
        'char', 'varchar', 'tinytext', 'text', 'mediumtext', 'longtext',
        'varchar(50)', 'varchar(100)', 'varchar(255)', 'varchar(500)',
        'date', 'time', 'datetime', 'timestamp', 'year',
        'binary', 'varbinary', 'tinyblob', 'blob', 'mediumblob', 'longblob',
        'json', 'enum', 'set',
    ],
    [DRIVER.SQLITE]: [
        'INTEGER', 'REAL', 'TEXT', 'BLOB', 'NUMERIC',
        'NULL', 'BOOLEAN', 'DATE', 'DATETIME',
    ],
};

export function getTypesForDriver(driver: string): string[] {
    const key = driver.toLowerCase().replace('sqlserver', DRIVER.SQLSERVER);
    return DB_TYPES[key] ?? DB_TYPES[DRIVER.SQLSERVER];
}
