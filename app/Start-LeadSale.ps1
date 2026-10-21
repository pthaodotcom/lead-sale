$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Test-Path -LiteralPath 'node_modules/vite/bin/vite.js')) {
    throw 'Run npm ci in the app directory first.'
}
& node 'node_modules/vite/bin/vite.js' --host 127.0.0.1 --port 5173
