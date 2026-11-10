#!/usr/bin/env pwsh
[CmdletBinding()]
param()

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
$ObjDir = '../Dotnet/obj'
$OldObjDir = '../Dotnet/obj1'

if (Test-Path -LiteralPath $BuildDir) {
    Write-Host "Removing '$BuildDir"
    Clear-BuildDirectory -Path $BuildDir
}

if (Test-Path -LiteralPath $ObjDir) {
    Write-Host "Removing '$ObjDir"
    Clear-BuildDirectory -Path $ObjDir
}

if (Test-Path -LiteralPath $OldObjDir) {
    Write-Host "Removing '$OldObjDir"
    Clear-BuildDirectory -Path $OldObjDir
}

Write-Host 'Done.'
exit 0
