#!/usr/bin/env pwsh

using namespace System.Runtime.InteropServices

[CmdletBinding()]
param (
    [Parameter()]
    [Switch]
    $NoCI,
    [Parameter()]
    [Switch]
    $BuildArm64
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$IsArm64 = [RuntimeInformation]::ProcessArchitecture -eq [Architecture]::Arm64

if ($IsArm64) {
    $BuildArm64 = $true
}

Set-Location -LiteralPath (Join-Path $PSScriptRoot '..')

$root = (Resolve-Path -LiteralPath .).Path

$Date = Get-Date -Format yyyyMMdd
$ZipName = 'VRCX_' + $Date + '.zip'
$SetupName = 'VRCX_' + $Date + '_Setup_x64.exe'

Write-Host 'Building .Net...' -ForegroundColor Green

if ($env:OS -eq 'Windows_NT') {
    $buildArguments = @(
        'Dotnet\VRCX-Cef.csproj', '-p:Configuration=Release', '-p:WarningLevel=0', '-p:Platform=x64',
        '-t:Clean;Build', '-maxcpucount', '--runtime', 'win-x64', '--self-contained'
    )
    dotnet build @buildArguments
}

if ([RuntimeInformation]::IsOSPlatform([OSPlatform]::Linux)) {
    if ($BuildArm64) {
        $buildArguments = @(
            'Dotnet/VRCX-Electron.csproj', '-p:Configuration=Release', '-p:WarningLevel=0', '-p:Platform=arm64',
            '-t:Clean;Build', '-maxcpucount', '--runtime', 'linux-arm64'
        )
    } else {
        $buildArguments = @(
            'Dotnet/VRCX-Electron.csproj', '-p:Configuration=Release', '-p:WarningLevel=0', '-p:Platform=x64',
            '-t:Clean;Build', '-maxcpucount', '--runtime', 'linux-x64'
        )
    }
    dotnet build @buildArguments
}

if ([RuntimeInformation]::IsOSPlatform([OSPlatform]::OSX)) {
    if ($BuildArm64) {
        $buildArguments = @(
            'Dotnet/VRCX-Electron.csproj', '-p:Configuration=Release', '-p:WarningLevel=0', '-p:Platform=arm64',
            '-t:Clean;Build', '-maxcpucount', '--runtime', 'osx-arm64'
        )
    } else {
        $buildArguments = @(
            'Dotnet/VRCX-Electron.csproj', '-p:Configuration=Release', '-p:WarningLevel=0', '-p:Platform=x64',
            '-t:Clean;Build', '-maxcpucount', '--runtime', 'osx-x64'
        )
    }
    dotnet build @buildArguments
}

Write-Host 'Building Node.js...' -ForegroundColor Green
Remove-Item -Path 'node_modules' -Force -Recurse -ErrorAction SilentlyContinue

if ($NoCI) {
    $installArguments = @('install', '--package-lock-only=false', '--no-save')
    npm @installArguments
} else {
    npm ci --loglevel=error
}


$ErrorActionPreference = 'Continue'

if ($env:OS -eq 'Windows_NT') {
    npm run prod
}

if ([RuntimeInformation]::IsOSPlatform([OSPlatform]::Linux) -or
    [RuntimeInformation]::IsOSPlatform([OSPlatform]::OSX)) {
    if ($BuildArm64) {
        npm run prod
        npm run build-electron-arm64
    } else {
        npm run prod
        npm run build-electron
    }
}

$ErrorActionPreference = 'Stop'

if ($env:OS -eq 'Windows_NT') {
    Remove-Item -Path 'build\Cef\html' -Force -Recurse -ErrorAction SilentlyContinue
    New-Item -ItemType Junction -Path "$root\build\Cef\html" -Target "$root\build\html"

    Write-Host 'Creating Zip...' -ForegroundColor Green
    Set-Location 'build\Cef'
    7z a -tzip $ZipName * -mx=7 -xr0!"*.log" -xr0!"*.pdb"
    Move-Item -LiteralPath $ZipName -Destination "..\..\$ZipName" -Force
    Set-Location ..\..\

    Write-Host 'Creating Installer...' -ForegroundColor Green
    $version = [IO.File]::ReadAllText((Join-Path $root 'Version'))
    Set-Location 'Installer'
    $definition = "!define PRODUCT_VERSION_FROM_FILE `"$version.0`"" + [Environment]::NewLine
    [IO.File]::WriteAllText((Join-Path $root 'Installer/version_define.nsh'), $definition)
    $nsisPath = 'C:\Program Files (x86)\NSIS\makensis.exe'
    &$nsisPath installer.nsi
    Start-Sleep -Seconds 1
    Move-Item -LiteralPath VRCX_Setup_x64.exe -Destination "..\$SetupName" -Force
    Set-Location ..

    Write-Host 'Creating SHA256-hash...' -ForegroundColor Green
    $hash = Get-FileHash -LiteralPath $SetupName -Algorithm SHA256
    $hashLine = "$($hash.Hash)  $SetupName"
    $hashText = $hashLine + [Environment]::NewLine
    [IO.File]::WriteAllText((Join-Path $root 'SHA256SUMS.txt'), $hashText, [Text.Encoding]::ASCII)
}

Write-Host 'Done!' -ForegroundColor Green
exit 0
