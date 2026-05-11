param(
  [string]$ZipPath = "C:\Users\ollet\OneDrive\Desktop\Rotmod_ETG.zip"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$outPath = Join-Path $root "data\etg-samples.js"

if (-not (Test-Path -LiteralPath $ZipPath)) {
  $fallback = "C:\Users\ollet\OneDrive\Desktop\g project\Rotmod_ETG.zip"
  if (Test-Path -LiteralPath $fallback) {
    $ZipPath = $fallback
  }
}

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Read-ZipText($zip, [string]$entryName) {
  $entry = $zip.GetEntry($entryName)
  if ($null -eq $entry) {
    return $null
  }
  $stream = $entry.Open()
  $reader = New-Object System.IO.StreamReader($stream)
  try {
    return $reader.ReadToEnd()
  }
  finally {
    $reader.Close()
  }
}

$zip = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
try {
  $rotmods = $zip.Entries |
    Where-Object { $_.FullName -like "*_rotmod.dat" } |
    Sort-Object FullName

  $samples = foreach ($entry in $rotmods) {
    $name = $entry.FullName -replace "_rotmod\.dat$", ""
    $rotmod = Read-ZipText $zip $entry.FullName
    $disk = Read-ZipText $zip "${name}_disk.dat"
    $bulge = Read-ZipText $zip "${name}_bulge.dat"

    if ($null -eq $rotmod -or $null -eq $disk -or $null -eq $bulge) {
      Write-Warning "Skipping $name because one component file is missing"
      continue
    }

    [pscustomobject]@{
      name = $name
      rotmod = $rotmod
      disk = $disk
      bulge = $bulge
    }
  }
}
finally {
  $zip.Dispose()
}

$json = $samples | ConvertTo-Json -Depth 4
"window.MTS_ETG_SAMPLES = $json;" | Set-Content -LiteralPath $outPath -Encoding UTF8
Write-Host "Wrote $($samples.Count) ETG samples to $outPath"
