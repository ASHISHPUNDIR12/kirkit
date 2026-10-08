#Requires -Version 5.1
#Requires -RunAsAdministrator
[CmdletBinding()]
param(
    [string]$Distro = 'Ubuntu',
    [string]$InterfaceAlias = 'Wi-Fi',
    [switch]$ExpoLan
)

$ErrorActionPreference = 'Stop'
$port = 3000
$ports = if ($ExpoLan) { @(3000, 8081) } else { @(3000) }
$projectRoot = Split-Path -Parent $PSScriptRoot
$mobileEnv = Join-Path $projectRoot 'mobile\.env'

# Never silently mark a new/public network as trusted.
$wifi = Get-NetIPAddress -InterfaceAlias $InterfaceAlias -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike '169.254.*' -and $_.AddressState -eq 'Preferred' } |
    Select-Object -First 1
if (-not $wifi) { throw "No active IPv4 address on $InterfaceAlias. Connect to your trusted Wi-Fi/hotspot first." }
$networkProfile = Get-NetConnectionProfile -InterfaceIndex $wifi.InterfaceIndex
if ($networkProfile.NetworkCategory -ne 'Private') {
    throw 'This network is not Private. Only on your trusted Wi-Fi/hotspot, set its Windows network profile to Private, then rerun.'
}
$lanIp = $wifi.IPAddress

$addresses = & wsl.exe -d $Distro -- hostname -I
if ($LASTEXITCODE -ne 0) { throw "Cannot get the address of WSL distribution $Distro." }
$wslIp = (($addresses -join ' ').Trim() -split '\s+' |
    Where-Object { $_ -match '^\d+\.\d+\.\d+\.\d+$' } |
    Select-Object -First 1)
if (-not $wslIp) { throw 'No WSL IPv4 address found.' }

# Refuse to change forwarding when the backend is not ready.
try {
    $health = Invoke-RestMethod -Uri "http://${wslIp}:${port}/health" -TimeoutSec 15
    if ($health.status -ne 'ok' -or $health.database -ne 'connected') { throw 'Health check failed.' }
} catch {
    throw "Start the backend in WSL first (cd backend; npm run dev), then retry. Windows could not verify http://${wslIp}:${port}/health."
}

Start-Service iphlpsvc
$forwarding = (& netsh interface portproxy show v4tov4) -join "`n"
if ($LASTEXITCODE -ne 0) { throw 'Unable to inspect Windows port forwarding.' }
foreach ($forwardPort in $ports) {
    $existing = $forwarding -match "(?m)^\s*$([regex]::Escape($lanIp))\s+$forwardPort\s+"
    if ($existing) {
        & netsh interface portproxy set v4tov4 "listenaddress=$lanIp" "listenport=$forwardPort" "connectaddress=$wslIp" "connectport=$forwardPort"
    } else {
        & netsh interface portproxy add v4tov4 "listenaddress=$lanIp" "listenport=$forwardPort" "connectaddress=$wslIp" "connectport=$forwardPort"
    }
    if ($LASTEXITCODE -ne 0) { throw "Unable to configure Windows port forwarding for port $forwardPort." }

    # Refresh only this project's rule, scoped to private Wi-Fi and local devices.
    $ruleName = "Kirkit-Dev-$forwardPort"
    Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    New-NetFirewallRule -Name $ruleName -DisplayName "Kirkit development port $forwardPort" `
        -Direction Inbound -Action Allow -Protocol TCP -LocalPort $forwardPort `
        -LocalAddress $lanIp -RemoteAddress LocalSubnet -InterfaceAlias $InterfaceAlias `
        -Profile Private | Out-Null
    Write-Host "Forwarding configured: ${lanIp}:${forwardPort} -> ${wslIp}:${forwardPort}"
}

$apiUrl = "http://${lanIp}:${port}"
$content = if (Test-Path -LiteralPath $mobileEnv) { [IO.File]::ReadAllText($mobileEnv) } else { '' }
$pattern = '(?m)^[ \t]*EXPO_PUBLIC_API_URL=[^\r\n]*'
$entry = "EXPO_PUBLIC_API_URL=$apiUrl"
if ([regex]::IsMatch($content, $pattern)) {
    $content = [regex]::Replace($content, $pattern, $entry)
} else {
    $content = $content.TrimEnd() + "`n$entry`n"
}
[IO.File]::WriteAllText($mobileEnv, $content, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "Updated mobile/.env: $entry"
Write-Host "On your PHONE, verify: $apiUrl/health"
if ($ExpoLan) {
    Write-Host 'Then in a second WSL terminal, from the project mobile directory, run:'
    Write-Host "REACT_NATIVE_PACKAGER_HOSTNAME=$lanIp npx expo start --lan --go --port 8081 --clear"
    Write-Host "After Expo starts, test on your PHONE: http://${lanIp}:8081/status"
    Write-Host 'Expected: packager-status:running. Then scan the QR code in Expo Go.'
    Write-Host 'Keep port 8081; if it is occupied, stop the old Expo process first.'
} else {
    Write-Host 'Then restart Expo in WSL: cd mobile; npx expo start --tunnel --clear'
}
Write-Host 'Phone reachability must be checked on the phone; this script cannot verify it.'
