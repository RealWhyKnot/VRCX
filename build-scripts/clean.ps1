#!/usr/bin/env pwsh
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Clear-BuildDirectory {
    [CmdletBinding()]
    [OutputType([void])]
    param (
        [Parameter(Mandatory)][string] $Path
    )

    Get-ChildItem -LiteralPath $Path -File -Recurse | ForEach-Object {
        Write-Host "Deleting '$($_.FullName)'"
        Remove-Item -LiteralPath $_
    }
}

Set-Location -LiteralPath $PSScriptRoot

$BuildDir = '../build'
$ObjDirs = @('../src/VRCX-Cef/obj', '../src/VRCX-Electron/obj', '../src/DBMerger/obj')

if (Test-Path -LiteralPath $BuildDir) {
    Write-Host "Removing '$BuildDir"
    Clear-BuildDirectory -Path $BuildDir
}

foreach ($ObjDir in $ObjDirs) {
    if (Test-Path -LiteralPath $ObjDir) {
        Write-Host "Removing '$ObjDir"
        Clear-BuildDirectory -Path $ObjDir
    }
}

Write-Host 'Done.'
exit 0
