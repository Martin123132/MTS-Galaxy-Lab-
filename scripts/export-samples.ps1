param(
  [string]$ZipPath = "C:\Users\ollet\OneDrive\Desktop\Rotmod_LTG (4).zip"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$outPath = Join-Path $root "data\samples.js"

if (-not (Test-Path -LiteralPath $ZipPath)) {
  $fallback = "C:\Users\ollet\OneDrive\Desktop\g project\Rotmod_LTG (4).zip"
  if (Test-Path -LiteralPath $fallback) {
    $ZipPath = $fallback
  }
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
try {
  $samples = foreach ($entry in ($zip.Entries | Where-Object { $_.FullName -like "*_rotmod.dat" } | Sort-Object FullName)) {
    $stream = $entry.Open()
    $reader = New-Object System.IO.StreamReader($stream)
    try {
      [pscustomobject]@{
        name = $entry.FullName
        text = $reader.ReadToEnd()
      }
    }
    finally {
      $reader.Close()
    }
  }
}
finally {
  $zip.Dispose()
}

$json = $samples | ConvertTo-Json -Depth 4
"window.MTS_SAMPLES = $json;" | Set-Content -LiteralPath $outPath -Encoding UTF8
Write-Host "Wrote $($samples.Count) samples to $outPath"
