param(
    [string] $EnvFile = ".env.local",
    [string] $Bucket = "design-sources",
    [switch] $DryRun
)

$ErrorActionPreference = "Stop"

function Import-DotEnvFile {
    param([string] $Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        return
    }

    Get-Content -LiteralPath $Path | ForEach-Object {
        $line = [string] $_
        if (-not $line.Trim() -or $line.TrimStart().StartsWith("#") -or -not $line.Contains("=")) {
            return
        }

        $key, $value = $line.Split("=", 2)
        $key = $key.Trim()
        $value = $value.Trim().Trim('"').Trim("'")
        if ($key) {
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}

function ConvertTo-UrlSafeToken {
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $rng.GetBytes($bytes)
    } finally {
        $rng.Dispose()
    }
    return [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function Get-Sha256Hex {
    param([string] $Value)

    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Value)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $hash = $sha.ComputeHash($bytes)
    } finally {
        $sha.Dispose()
    }
    return (($hash | ForEach-Object { $_.ToString("x2") }) -join "")
}

function ConvertTo-StorageDesignId {
    param([string] $Value)

    $safe = ($Value.Trim() -replace "[^a-zA-Z0-9._-]+", "-").Trim("-")
    if ($safe.Length -gt 120) {
        return $safe.Substring(0, 120)
    }
    return $safe
}

Import-DotEnvFile -Path $EnvFile

$supabaseUrl = $env:SUPABASE_URL
if (-not $supabaseUrl) {
    $supabaseUrl = $env:NEXT_PUBLIC_SUPABASE_URL
}
$supabaseUrl = [string] $supabaseUrl
$supabaseUrl = $supabaseUrl.TrimEnd("/")
$serviceRoleKey = $env:SUPABASE_SERVICE_ROLE_KEY

if (-not $supabaseUrl -or -not $serviceRoleKey) {
    throw "SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorios."
}

$headers = @{
    apikey = $serviceRoleKey
    Authorization = "Bearer $serviceRoleKey"
}

$snapshotsUrl = "$supabaseUrl/rest/v1/design_snapshots?select=design_id,design_svg,masked_svg_path&masked_svg_path=is.null"
$snapshots = Invoke-RestMethod -Method Get -Uri $snapshotsUrl -Headers $headers
$processed = 0
$skipped = 0

foreach ($snapshot in @($snapshots)) {
    $designId = [string] $snapshot.design_id
    $svg = [string] $snapshot.design_svg
    if (-not $designId -or -not $svg.TrimStart().StartsWith("<svg")) {
        $skipped += 1
        Write-Host "skip $designId"
        continue
    }

    $safeId = ConvertTo-StorageDesignId -Value $designId
    $path = "designs/$safeId/masked.svg"
    $readToken = ConvertTo-UrlSafeToken
    $readTokenHash = Get-Sha256Hex -Value $readToken

    Write-Host "backfill $designId -> $Bucket/$path"
    if (-not $DryRun) {
        $uploadHeaders = @{
            apikey = $serviceRoleKey
            Authorization = "Bearer $serviceRoleKey"
            "Content-Type" = "image/svg+xml"
            "x-upsert" = "true"
        }
        Invoke-RestMethod `
            -Method Put `
            -Uri "$supabaseUrl/storage/v1/object/$Bucket/$path" `
            -Headers $uploadHeaders `
            -Body $svg | Out-Null

        $patchBody = @{
            storage_bucket = $Bucket
            masked_svg_path = $path
            asset_manifest = @{}
            read_token_hash = $readTokenHash
            design_preview = "/api/designs?designId=$([System.Uri]::EscapeDataString($designId))&token=$([System.Uri]::EscapeDataString($readToken))&asset=svg"
            updated_at = (Get-Date).ToUniversalTime().ToString("o")
        } | ConvertTo-Json -Depth 8

        Invoke-RestMethod `
            -Method Patch `
            -Uri "$supabaseUrl/rest/v1/design_snapshots?design_id=eq.$([System.Uri]::EscapeDataString($designId))" `
            -Headers ($headers + @{ "Content-Type" = "application/json"; Prefer = "return=minimal" }) `
            -Body $patchBody | Out-Null
    }

    $processed += 1
}

Write-Host "processed=$processed skipped=$skipped"
