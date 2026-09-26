# Download the committed GitHub version; never package local working files.
param([string]$Branch = 'main')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$remote = (& git -C $projectRoot remote get-url origin)
if ($LASTEXITCODE -ne 0) { throw 'Could not read the origin remote.' }
if ($remote -notmatch '^https://github\.com/(?<owner>[A-Za-z0-9_.-]+)/(?<repository>[A-Za-z0-9_.-]+?)(?:\.git)?$') {
    throw 'This backup command requires an HTTPS github.com origin URL.'
}
$owner = $Matches.owner
$repository = $Matches.repository
$reference = "refs/heads/$Branch"
$remoteLine = @(& git -C $projectRoot ls-remote origin $reference)
if ($LASTEXITCODE -ne 0 -or $remoteLine.Count -ne 1) { throw "Could not resolve GitHub branch '$Branch'." }
$commit = ($remoteLine[0] -split '\s+')[0]
if ($commit -notmatch '^[a-f0-9]{40}$') { throw 'GitHub returned an invalid commit ID.' }
$backupDirectory = Join-Path $projectRoot 'backups'
[System.IO.Directory]::CreateDirectory($backupDirectory) | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$stem = "$repository-github-$stamp-$($commit.Substring(0, 12))"
$zipPath = Join-Path $backupDirectory "$stem.zip"
$temporary = "$zipPath.partial"
$manifestPath = Join-Path $backupDirectory "$stem.json"
$url = "https://codeload.github.com/$owner/$repository/zip/$commit"
if ((Test-Path -LiteralPath $zipPath) -or (Test-Path -LiteralPath $temporary)) { throw 'Backup path already exists; retry in a moment.' }
try {
    Invoke-WebRequest -Uri $url -OutFile $temporary -UseBasicParsing
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [System.IO.Compression.ZipFile]::OpenRead($temporary)
    try {
        $prefix = "$repository-$commit/"
        $entries = @($archive.Entries | Where-Object { $_.Name })
        if ($entries.Count -eq 0) { throw 'The downloaded archive has no files.' }
        if (-not ($entries.FullName -contains ($prefix + 'public/index.html'))) { throw 'The backup is missing the published website entry point.' }
        if (-not ($entries.FullName -contains ($prefix + '.github/workflows/update-stats.yml'))) { throw 'The backup is missing the publishing workflow.' }
        # Read every entry to confirm it decompresses before keeping the backup.
        foreach ($entry in $entries) {
            if (-not $entry.FullName.StartsWith($prefix, [StringComparison]::Ordinal)) { throw 'Unexpected archive root.' }
            $stream = $entry.Open()
            try { $stream.CopyTo([System.IO.Stream]::Null) } finally { $stream.Dispose() }
        }
        $fileCount = $entries.Count
    } finally { $archive.Dispose() }
    Move-Item -LiteralPath $temporary -Destination $zipPath
    $metadata = [ordered]@{
        repository = "https://github.com/$owner/$repository"
        branch = $Branch
        commit = $commit
        downloadedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
        archiveUrl = $url
        files = $fileCount
        bytes = (Get-Item -LiteralPath $zipPath).Length
        sha256 = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash
        contents = 'Committed GitHub repository at this commit; excludes uncommitted local changes and external Google/Wix services.'
    }
    $metadata | ConvertTo-Json | Set-Content -LiteralPath $manifestPath -Encoding UTF8
    Write-Output "Backup: $zipPath"
    Write-Output "Record: $manifestPath"
    Write-Output "Verified $fileCount files from GitHub commit $commit"
} finally {
    if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary }
}
