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
        'src\VRCX-Cef\VRCX-Cef.csproj', '-p:Configuration=Release', '-p:WarningLevel=0', '-p:Platform=x64',
        '-t:Clean;Build', '-maxcpucount', '--runtime', 'win-x64', '--self-contained'
    )
    dotnet build @buildArguments
    if ($LASTEXITCODE -ne 0) { throw "dotnet build failed with exit code $LASTEXITCODE" }
}

if ([RuntimeInformation]::IsOSPlatform([OSPlatform]::Linux)) {
    if ($BuildArm64) {
        $buildArguments = @(
            'src/VRCX-Electron/VRCX-Electron.csproj', '-p:Configuration=Release', '-p:WarningLevel=0', '-p:Platform=arm64',
            '-t:Clean;Build', '-maxcpucount', '--runtime', 'linux-arm64'
        )
    } else {
        $buildArguments = @(
            'src/VRCX-Electron/VRCX-Electron.csproj', '-p:Configuration=Release', '-p:WarningLevel=0', '-p:Platform=x64',
            '-t:Clean;Build', '-maxcpucount', '--runtime', 'linux-x64'
        )
    }
    dotnet build @buildArguments
    if ($LASTEXITCODE -ne 0) { throw "dotnet build failed with exit code $LASTEXITCODE" }
}

if ([RuntimeInformation]::IsOSPlatform([OSPlatform]::OSX)) {
    if ($BuildArm64) {
        $buildArguments = @(
            'src/VRCX-Electron/VRCX-Electron.csproj', '-p:Configuration=Release', '-p:WarningLevel=0', '-p:Platform=arm64',
            '-t:Clean;Build', '-maxcpucount', '--runtime', 'osx-arm64'
        )
    } else {
        $buildArguments = @(
            'src/VRCX-Electron/VRCX-Electron.csproj', '-p:Configuration=Release', '-p:WarningLevel=0', '-p:Platform=x64',
            '-t:Clean;Build', '-maxcpucount', '--runtime', 'osx-x64'
        )
    }
    dotnet build @buildArguments
    if ($LASTEXITCODE -ne 0) { throw "dotnet build failed with exit code $LASTEXITCODE" }
}

Write-Host 'Building Node.js...' -ForegroundColor Green
Remove-Item -Path 'node_modules' -Force -Recurse -ErrorAction SilentlyContinue

if ($NoCI) {
    $installArguments = @('install', '--package-lock-only=false', '--no-save')
    npm @installArguments
    if ($LASTEXITCODE -ne 0) { throw "npm install failed with exit code $LASTEXITCODE" }
} else {
    npm ci --loglevel=error
    if ($LASTEXITCODE -ne 0) { throw "npm ci failed with exit code $LASTEXITCODE" }
}


$ErrorActionPreference = 'Continue'

if ($env:OS -eq 'Windows_NT') {
    npm run prod
    if ($LASTEXITCODE -ne 0) { throw "npm run prod failed with exit code $LASTEXITCODE" }
}

if ([RuntimeInformation]::IsOSPlatform([OSPlatform]::Linux) -or
    [RuntimeInformation]::IsOSPlatform([OSPlatform]::OSX)) {
    if ($BuildArm64) {
        npm run prod
        if ($LASTEXITCODE -ne 0) { throw "npm run prod failed with exit code $LASTEXITCODE" }
        npm run build-electron-arm64
        if ($LASTEXITCODE -ne 0) { throw "npm run build-electron-arm64 failed with exit code $LASTEXITCODE" }
    } else {
        npm run prod
        if ($LASTEXITCODE -ne 0) { throw "npm run prod failed with exit code $LASTEXITCODE" }
        npm run build-electron
        if ($LASTEXITCODE -ne 0) { throw "npm run build-electron failed with exit code $LASTEXITCODE" }
    }
}

$ErrorActionPreference = 'Stop'

if ($env:OS -eq 'Windows_NT') {
    Remove-Item -Path 'build\Cef\html' -Force -Recurse -ErrorAction SilentlyContinue
    New-Item -ItemType Junction -Path "$root\build\Cef\html" -Target "$root\build\html"

    Write-Host 'Creating Zip...' -ForegroundColor Green
    Set-Location 'build\Cef'
    7z a -tzip $ZipName * -mx=7 -xr0!"*.log" -xr0!"*.pdb"
    if ($LASTEXITCODE -ne 0) { throw "7z a failed with exit code $LASTEXITCODE" }
    Move-Item -LiteralPath $ZipName -Destination "..\..\$ZipName" -Force
    Set-Location ..\..\

    Write-Host 'Creating Installer...' -ForegroundColor Green
    $version = [IO.File]::ReadAllText((Join-Path $root 'Version'))
    Set-Location 'Installer'
    $definition = "!define PRODUCT_VERSION_FROM_FILE `"$version.0`"" + [Environment]::NewLine
    [IO.File]::WriteAllText((Join-Path $root 'Installer/version_define.nsh'), $definition)
    $nsisPath = 'C:\Program Files (x86)\NSIS\makensis.exe'
    &$nsisPath installer.nsi
    if ($LASTEXITCODE -ne 0) { throw "makensis failed with exit code $LASTEXITCODE" }
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
