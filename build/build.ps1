param([string]$OutputDirectory = '', [switch]$IncludeSource)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$version = (Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json).version
if (!$OutputDirectory) { $OutputDirectory = Join-Path $projectRoot 'dist' }
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (!(Test-Path -LiteralPath $compiler)) { throw '.NET Framework 4.x csc.exe not found.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
Copy-Item -LiteralPath (Join-Path $projectRoot 'LICENSE') -Destination (Join-Path $projectRoot 'src\payload\LICENSE') -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'THIRD-PARTY-NOTICES.md') -Destination (Join-Path $projectRoot 'src\payload\THIRD-PARTY-NOTICES.md') -Force
$vendor = Join-Path $projectRoot 'src\payload\vendor\webwallgl\webwallgl.global.min.js'
if ((Get-FileHash -LiteralPath $vendor -Algorithm SHA256).Hash.ToLowerInvariant() -ne 'ee2fbe9a4d15a9ecca837c08a76b90d8c3d98dd2619976929890c9f51de2ff9c') { throw 'Official WebWallGL checksum mismatch.' }
& node (Join-Path $projectRoot 'tools\check-provenance.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Release provenance check failed.' }
$zip = Join-Path $OutputDirectory 'payload.zip'
if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip }
[IO.Compression.ZipFile]::CreateFromDirectory((Join-Path $projectRoot 'src\payload'), $zip)
$output = Join-Path $OutputDirectory 'ATK-HUB-Wallpaper-Plugin.exe'
& $compiler /nologo /target:winexe /platform:x64 /optimize+ "/out:$output" "/resource:$zip,payload.zip" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll /reference:System.Core.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll (Join-Path $projectRoot 'src\installer\Installer.cs')
if ($LASTEXITCODE -ne 0) { throw 'Installer compilation failed.' }
Remove-Item -LiteralPath $zip
$releaseFiles = @($output,(Join-Path $projectRoot 'README.md'),(Join-Path $projectRoot 'LICENSE'),(Join-Path $projectRoot 'THIRD-PARTY-NOTICES.md'))
$hashFiles = @($output)
if ($IncludeSource) {
$sourceZip = Join-Path $OutputDirectory "ATK-HUB-Wallpaper-Plugin-$version-source.zip"
if (Test-Path -LiteralPath $sourceZip) { Remove-Item -LiteralPath $sourceZip }
$sourceArchive = [IO.Compression.ZipFile]::Open($sourceZip, [IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($folder in @('src','build','tools','test','docs','assets/screenshots')) {
    if (!(Test-Path -LiteralPath (Join-Path $projectRoot $folder))) { continue }
    Get-ChildItem -LiteralPath (Join-Path $projectRoot $folder) -Recurse -File | ForEach-Object {
      $entryName = $_.FullName.Substring($projectRoot.Length + 1).Replace('\','/')
      if ($entryName -eq 'docs/images/properties-chinese.png') { return }
      [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($sourceArchive, $_.FullName, $entryName) | Out-Null
    }
  }
  foreach ($name in @('README.md','LICENSE','THIRD-PARTY-NOTICES.md','package.json','.gitignore','.gitattributes')) {
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($sourceArchive, (Join-Path $projectRoot $name), $name) | Out-Null
  }
} finally { $sourceArchive.Dispose() }
$releaseFiles += $sourceZip
$hashFiles += $sourceZip
}
$releaseZip = Join-Path $OutputDirectory "ATK-HUB-Wallpaper-Plugin-$version.zip"
if (Test-Path -LiteralPath $releaseZip) { Remove-Item -LiteralPath $releaseZip }
$releaseArchive = [IO.Compression.ZipFile]::Open($releaseZip, [IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($file in $releaseFiles) {
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($releaseArchive, $file, [IO.Path]::GetFileName($file)) | Out-Null
  }
} finally { $releaseArchive.Dispose() }
Get-Item -LiteralPath $output | Select-Object FullName, Length
$hashFiles += $releaseZip
$checksums = foreach ($file in $hashFiles) {
  $digest = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
  "$digest  $([IO.Path]::GetFileName($file))"
}
[IO.File]::WriteAllLines((Join-Path $OutputDirectory 'SHA256SUMS.txt'), $checksums, [Text.Encoding]::ASCII)
$checksums | ForEach-Object { Write-Host $_ }
