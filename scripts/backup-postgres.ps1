param(
    [string]$BackupDir = ".\backups",
    [int]$RetentionDays = 7
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$file = Join-Path $BackupDir "algotrade-$stamp.sql"

# Run pg_dump inside the existing PostgreSQL container.
docker compose exec -T db pg_dump -U postgres algotrade | Out-File -FilePath $file -Encoding utf8
Write-Host "Created $file"

$cutoff = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem $BackupDir -Filter "algotrade-*.sql" -File | Where-Object { $_.LastWriteTime -lt $cutoff } | Remove-Item -Force
