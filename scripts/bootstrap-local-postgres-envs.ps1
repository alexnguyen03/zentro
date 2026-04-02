param(
    [string]$PgHost = "localhost",
    [int]$PgPort = 5432,
    [string]$AdminDb = "postgres",
    [string]$AdminUser = "postgres",
    [string]$AdminPassword = "123456",
    [string]$AppUser = "zentro_app",
    [string]$AppPassword = "zentro_app_pw",
    [string]$DbPrefix = "zentro_",
    [string[]]$EnvKeys = @("loc", "tes", "dev", "sta", "pro"),
    [int]$RowCount = 800000
)

$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$seedSqlPath = Join-Path $scriptRoot "sql\bootstrap_postgres_env_seed.sql"

if (-not (Test-Path -LiteralPath $seedSqlPath)) {
    throw "Seed SQL file not found: $seedSqlPath"
}

function Resolve-PsqlPath {
    $command = Get-Command psql -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    $postgresRoots = @()
    if ($env:ProgramFiles) {
        $postgresRoots += Join-Path $env:ProgramFiles "PostgreSQL"
    }
    if (${env:ProgramFiles(x86)}) {
        $postgresRoots += Join-Path ${env:ProgramFiles(x86)} "PostgreSQL"
    }

    foreach ($root in $postgresRoots) {
        if (-not (Test-Path -LiteralPath $root)) {
            continue
        }

        $versionDirs = Get-ChildItem -Path $root -Directory -ErrorAction SilentlyContinue |
            Sort-Object Name -Descending
        foreach ($versionDir in $versionDirs) {
            $candidate = Join-Path $versionDir.FullName "bin\psql.exe"
            if (Test-Path -LiteralPath $candidate) {
                return $candidate
            }
        }
    }

    return $null
}

$psqlPath = Resolve-PsqlPath
if (-not $psqlPath) {
    throw "psql was not found in PATH or common PostgreSQL install folders. Please install PostgreSQL client tools or add psql.exe to PATH."
}

function Escape-SqlLiteral {
    param([string]$Value)
    return $Value -replace "'", "''"
}

function Escape-SqlIdentifier {
    param([string]$Value)
    return '"' + ($Value -replace '"', '""') + '"'
}

function Invoke-Psql {
    param(
        [string]$User,
        [string]$Database,
        [string]$Password,
        [string[]]$ExtraArgs
    )

    $previousPassword = $env:PGPASSWORD
    try {
        if ([string]::IsNullOrEmpty($Password)) {
            Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
        } else {
            $env:PGPASSWORD = $Password
        }

        & $psqlPath -h $PgHost -p $PgPort.ToString() -U $User -d $Database -v ON_ERROR_STOP=1 @ExtraArgs
        if ($LASTEXITCODE -ne 0) {
            throw "psql failed with exit code $LASTEXITCODE"
        }
    } finally {
        if ($null -ne $previousPassword) {
            $env:PGPASSWORD = $previousPassword
        } else {
            Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
        }
    }
}

function Invoke-PsqlCapture {
    param(
        [string]$User,
        [string]$Database,
        [string]$Password,
        [string[]]$ExtraArgs
    )

    $previousPassword = $env:PGPASSWORD
    try {
        if ([string]::IsNullOrEmpty($Password)) {
            Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
        } else {
            $env:PGPASSWORD = $Password
        }

        $output = & $psqlPath -h $PgHost -p $PgPort.ToString() -U $User -d $Database -v ON_ERROR_STOP=1 @ExtraArgs
        if ($LASTEXITCODE -ne 0) {
            throw "psql failed with exit code $LASTEXITCODE"
        }

        return $output
    } finally {
        if ($null -ne $previousPassword) {
            $env:PGPASSWORD = $previousPassword
        } else {
            Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
        }
    }
}

$appUserLiteral = Escape-SqlLiteral $AppUser
$appUserIdent = Escape-SqlIdentifier $AppUser
$appPasswordLiteral = Escape-SqlLiteral $AppPassword

Write-Host "Creating/updating app role '$AppUser'..."
$ensureRoleSql = @"
DO `$`$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$appUserLiteral') THEN
        EXECUTE 'CREATE ROLE $appUserIdent LOGIN PASSWORD ''$appPasswordLiteral''';
    ELSE
        EXECUTE 'ALTER ROLE $appUserIdent WITH LOGIN PASSWORD ''$appPasswordLiteral''';
    END IF;
END
`$`$;
"@

Invoke-Psql -User $AdminUser -Database $AdminDb -Password $AdminPassword -ExtraArgs @("-c", $ensureRoleSql)

foreach ($envKey in $EnvKeys) {
    $dbName = "$DbPrefix$envKey"
    $dbLiteral = Escape-SqlLiteral $dbName
    $dbIdent = Escape-SqlIdentifier $dbName

    Write-Host "Ensuring database '$dbName'..."
    $checkDbSql = "SELECT 1 FROM pg_database WHERE datname = '$dbLiteral';"
    $dbExistsOutput = Invoke-PsqlCapture -User $AdminUser -Database $AdminDb -Password $AdminPassword -ExtraArgs @("-tAc", $checkDbSql)
    $dbExists = (($dbExistsOutput | Out-String).Trim() -eq "1")

    if (-not $dbExists) {
        $createDbSql = "CREATE DATABASE $dbIdent OWNER $appUserIdent;"
        Invoke-Psql -User $AdminUser -Database $AdminDb -Password $AdminPassword -ExtraArgs @("-c", $createDbSql)
    }

    $grantDbSql = "GRANT ALL PRIVILEGES ON DATABASE $dbIdent TO $appUserIdent;"
    Invoke-Psql -User $AdminUser -Database $AdminDb -Password $AdminPassword -ExtraArgs @("-c", $grantDbSql)

    Write-Host "Seeding schema/data for env '$envKey' on DB '$dbName'..."
    Invoke-Psql -User $AppUser -Database $dbName -Password $AppPassword -ExtraArgs @(
        "-v", "env_key=$envKey",
        "-v", "db_name=$dbName",
        "-v", "app_user=$AppUser",
        "-v", "row_count=$RowCount",
        "-f", $seedSqlPath
    )
}

Write-Host ""
Write-Host "Done. Created/updated databases for envs: $($EnvKeys -join ', ')"
Write-Host "App user: $AppUser"
Write-Host "Rows per data table: $RowCount"
