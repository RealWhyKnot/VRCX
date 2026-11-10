#!/usr/bin/env pwsh
#Requires -Version 7.4
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidatePattern('^\d{4}\.\d+\.\d+\.\d+(-beta)?$')]
    [string] $Version
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$numericVersion = $Version -replace '-beta$', ''
$parts = $numericVersion.Split('.')
$packageVersion = '{0}.{1}.{2}-{3}' -f $parts[0], $parts[1], $parts[2], $parts[3]
$runtimeVersion = $Version
if ($Version.EndsWith('-beta')) {
    $packageVersion += '-beta'
    $revision = git -C $root rev-parse --short=7 HEAD
    if ($LASTEXITCODE -ne 0) { throw "revision lookup failed ($LASTEXITCODE)" }
    $runtimeVersion = "$Version-$revision"
}
[IO.File]::WriteAllText((Join-Path $root 'Version'), "$runtimeVersion`n")
$definition = '!define PRODUCT_VERSION_FROM_FILE "{0}"' -f $numericVersion
[IO.File]::WriteAllText((Join-Path $root 'Installer/version_define.nsh'), "$definition`r`n")
$packagePath = Join-Path $root 'package.json'
$package = ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($packagePath))
$package.version = $packageVersion
[IO.File]::WriteAllText($packagePath, (ConvertTo-Json -InputObject $package -Depth 20) + "`n")
exit 0
