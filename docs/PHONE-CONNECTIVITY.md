# Connect Expo Go on Android to the WSL backend

## Diagnosis in this project

Express already binds to `0.0.0.0` on `PORT` (3000 locally). Login and signup
correctly call `POST /auth/login` and `POST /auth/signup`. Expo's environment
loader reads `http://192.168.1.10:3000` from `mobile/.env`. No authentication
change is needed for a TCP connection failure.

The phone cannot reach the Windows Wi-Fi address while Windows localhost works.
That isolates the immediate problem to the path from phone to the listener:
WSL NAT forwarding, Windows/Hyper-V firewall, or Wi-Fi client isolation. The
specific Windows rule state could not be inspected from the restricted workspace.
Windows localhost forwarding does not establish LAN forwarding into WSL2.
See [Microsoft's WSL networking guide](https://learn.microsoft.com/en-us/windows/wsl/networking).

The Expo `--tunnel` URL serves the Expo development server, not this API. The API
needs LAN routing or its own HTTPS tunnel. See [Expo CLI tunneling](https://docs.expo.dev/more/expo-cli/#tunneling).

## 1. Check the backend in a normal WSL terminal

Keep the backend running in its own terminal:

```sh
cd /home/ashish_pundir/projects/kirkit/backend
npm run build
npm start
```

In another WSL terminal:

```sh
ss -ltnp 'sport = :3000'
curl --max-time 10 -i http://127.0.0.1:3000/live
curl --max-time 15 -i http://127.0.0.1:3000/health
npm run check:api -- http://127.0.0.1:3000
```

Expect a listener on `0.0.0.0:3000`, `/live` returning `{"status":"ok"}`, and
`/health` returning `{"status":"ok","database":"connected"}`. The checker also
verifies invalid login/signup requests return JSON `400` and unauthenticated
matches return `401`. It sends no credentials and creates no accounts. A JSON
`404` at `/` still proves HTTP connectivity; use `/health` for the actual check.

If startup fails with a DNS/database error, fix that first. If auth later returns
`503` after health succeeds, verify the auth migration with `npm run prisma:status`
and apply pending migrations deliberately using `npm run prisma:deploy`.

## 2. Inspect Windows, then choose NAT or mirrored instructions

Open **Windows Terminal → PowerShell → Run as Administrator on Windows**, not
Ubuntu/WSL. Run:

```powershell
wsl.exe --list --verbose
Get-NetConnectionProfile
Get-NetIPAddress -AddressFamily IPv4 | Format-Table IPAddress,InterfaceAlias
netsh interface portproxy show v4tov4
Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if (Test-Path "$env:USERPROFILE\.wslconfig") { Get-Content "$env:USERPROFILE\.wslconfig" }
```

For newer WSL, `wsl.exe -d Ubuntu -- wslinfo --networking-mode` reports the active
mode. If unavailable, check `.wslconfig`; NAT is the default. Replace `Ubuntu`
below with the exact distribution name from `--list --verbose`. Do not switch
networking modes just to apply these instructions. Use the mirrored section if
mirrored mode is already active.

## 3. NAT mode: forward only the Windows Wi-Fi address

In the same **Administrator PowerShell**, set the following. Enter your phone's
IPv4 address from Android Settings → Wi-Fi → connected network when prompted.
The phone and laptop must be on the same trusted Wi-Fi, not a guest/isolated SSID.

```powershell
$kirkitDistro = 'Ubuntu'
$kirkitLanIp = '192.168.1.10'
$kirkitPhoneIp = (Read-Host 'Phone Wi-Fi IPv4 address').Trim()
$kirkitParsedPhoneIp = [System.Net.IPAddress]::Parse($kirkitPhoneIp)
if ($kirkitParsedPhoneIp.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork) { throw 'Enter an IPv4 address' }
$kirkitInterface = Get-NetIPAddress -AddressFamily IPv4 -IPAddress $kirkitLanIp -ErrorAction Stop
$kirkitProfile = Get-NetConnectionProfile -InterfaceIndex $kirkitInterface.InterfaceIndex
if ($kirkitProfile.NetworkCategory -ne 'Private') { throw 'Use a trusted Private Wi-Fi profile; see instructions below' }
$kirkitWslAddresses = (wsl.exe -d $kirkitDistro -- hostname -I)
if ($LASTEXITCODE -ne 0) { throw 'Cannot read the WSL address' }
$kirkitWslIp = ($kirkitWslAddresses.Trim() -split '\s+' | Where-Object { $_ -match '^\d+\.\d+\.\d+\.\d+$' } | Select-Object -First 1)
if (-not $kirkitWslIp) { throw 'No WSL IPv4 address found' }
$kirkitWslIp
curl.exe --max-time 15 --fail "http://${kirkitWslIp}:3000/health"
if ($LASTEXITCODE -ne 0) { throw 'Windows cannot reach the WSL backend; resolve this before forwarding' }
```

If the Wi-Fi profile is Public, change **only this interface**, and only if it is
your trusted home/development network, then rerun the block:

```powershell
Set-NetConnectionProfile -InterfaceIndex $kirkitInterface.InterfaceIndex -NetworkCategory Private
```

Inspect the existing `portproxy` output first. If a mapping already exists for
`192.168.1.10:3000`, ensure it belongs to this backend before updating it. Do not
remove unrelated mappings. With no conflicting mapping, run:

```powershell
Start-Service iphlpsvc
netsh interface portproxy add v4tov4 listenaddress=$kirkitLanIp listenport=3000 connectaddress=$kirkitWslIp connectport=3000
if ($LASTEXITCODE -ne 0) { throw 'Port forwarding failed' }
Get-NetFirewallRule -Name 'Kirkit-Phone-3000' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -Name 'Kirkit-Phone-3000' -DisplayName 'Kirkit API from Android phone' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 -LocalAddress $kirkitLanIp -RemoteAddress $kirkitPhoneIp -InterfaceAlias $kirkitInterface.InterfaceAlias -Profile Private
netsh interface portproxy show v4tov4
curl.exe --max-time 15 --fail "http://${kirkitLanIp}:3000/health"
```

This rule allows only the phone, on the private Wi-Fi interface, to port 3000.
It does not open PostgreSQL or disable the firewall. No router/WAN forwarding is
needed. WSL's IP can change after a restart: rerun the checks and update the
mapping with `netsh interface portproxy set v4tov4` using the same arguments.
Update the rule if the phone or laptop gets a different DHCP address.

If Windows cannot reach the WSL IP but localhost works, inspect Hyper-V firewall
policy and any existing Linux firewall (`sudo ufw status`). A managed policy may
require your administrator. Do not globally allow inbound traffic. For a confirmed
Hyper-V block in NAT mode, use a rule limited to the Windows-side WSL gateway
address and port 3000; do not use the mirrored phone-address rule below, because
NAT's proxy connects from Windows rather than directly from the phone.
For that confirmed NAT/Hyper-V block, run this in Administrator PowerShell, then
repeat the WSL-IP health check before continuing:

```powershell
$kirkitDefaultRoute = wsl.exe -d $kirkitDistro -- ip -4 route show default
if ($LASTEXITCODE -ne 0 -or $kirkitDefaultRoute -notmatch 'via (\d+\.\d+\.\d+\.\d+)') { throw 'Cannot determine Windows WSL gateway' }
$kirkitGatewayIp = $Matches[1]
New-NetFirewallHyperVRule -Name 'Kirkit-NAT-3000-HyperV' -DisplayName 'Kirkit API from Windows proxy' -Direction Inbound -Action Allow -VMCreatorId '{40E0AC32-46A5-438A-A0B2-2B479E8F2E90}' -Protocol TCP -LocalPorts 3000 -RemoteAddresses $kirkitGatewayIp
```

## Mirrored mode alternative (only if already active)

Do not add NAT port forwarding. Set the LAN/phone/interface variables above and
use the same narrowly scoped Windows firewall rule. If Hyper-V is blocking LAN
traffic, add this **Administrator PowerShell** rule:

```powershell
New-NetFirewallHyperVRule -Name 'Kirkit-Phone-3000-HyperV' -DisplayName 'Kirkit Android API' -Direction Inbound -Action Allow -VMCreatorId '{40E0AC32-46A5-438A-A0B2-2B479E8F2E90}' -Protocol TCP -LocalPorts 3000 -RemoteAddresses $kirkitPhoneIp
```

The rule is limited to the phone and API port. Do not change Hyper-V's default
inbound action. [Hyper-V rule reference](https://learn.microsoft.com/en-us/powershell/module/netsecurity/new-netfirewallhypervrule).

## 4. Verify on the phone, then reload Expo

Open **`http://192.168.1.10:3000/health` in the phone browser**. If Windows succeeds
but the phone fails, check the phone IP against the firewall rule, guest Wi-Fi/AP
client isolation, VPN routing, and third-party firewall policy. More JavaScript
or CORS changes will not repair a failed TCP connection. No Android cleartext
configuration was loosened; Expo Go uses its own native binary. If a future custom
build specifically reports `CLEARTEXT communication not permitted`, prefer HTTPS.

Keep this in `mobile/.env`:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.10:3000
```

From a normal WSL terminal, stop the old Expo process and restart:

```sh
cd /home/ashish_pundir/projects/kirkit/mobile
npx expo start --tunnel --clear
```

Reload the project in Expo Go. The login screen now has **Check connection** and,
in development, displays the effective API origin. Both login and signup share
that origin. Check connection must succeed before trying a disposable test login.
The app logs only method, route template, origin, duration and HTTP status, never
passwords, tokens, headers, request/response bodies or database URLs.

Expo statically inlines `process.env.EXPO_PUBLIC_API_URL`. `.env.local` and shell
variables may override `.env`; the displayed origin confirms what the phone's
bundle actually uses. Reload after changes. See [Expo environment variables](https://docs.expo.dev/guides/environment-variables/).
Do not put secrets in any `EXPO_PUBLIC_` variable. HTTP LAN testing should use
only a trusted development network and disposable credentials; use HTTPS below
for encrypted traffic.

## 5. HTTPS backend tunnel if LAN routing is unavailable

`cloudflared` is already installed in this WSL environment. No public tunnel was
started as part of this change. A quick tunnel exposes a temporary public API:
use a disposable development database and test accounts, retain the existing
bearer authentication/ownership checks and database-backed login/signup limits,
share the URL only with testers, and stop it when finished. The URL itself is not
access control. This is not a production deployment; do not tunnel a production
database-backed instance merely to work around Wi-Fi restrictions.

In a normal WSL terminal, with the development backend already passing health:

```sh
cloudflared tunnel --url http://127.0.0.1:3000
```

Keep it running. Copy the generated `https://...trycloudflare.com` origin, then:

```sh
cd /home/ashish_pundir/projects/kirkit/backend
npm run check:api -- https://YOUR-ACTUAL-HOST.trycloudflare.com
```

Use that exact HTTPS origin in `mobile/.env`, without `/health` or `/auth`:

```dotenv
EXPO_PUBLIC_API_URL=https://YOUR-ACTUAL-HOST.trycloudflare.com
```

Restart Expo with `--tunnel --clear`. Open the HTTPS `/health` URL on the phone,
then use Check connection and test signup/login. No Windows forwarding is needed
for this outbound tunnel. Only the Express HTTP port is tunneled, never Neon or
port 5432. HTTPS certificate validation stays enabled. Leave `TRUST_PROXY` at its
safe default unless configuring a trusted proxy deliberately; attempts may share
the connector's IP limit. Do not bypass an access gateway with credentials embedded
in the app; a gateway sign-in HTML response is now identified by the client.

Quick tunnel hostnames change when restarted; update the mobile URL accordingly.
For ongoing private access use a managed tunnel/access arrangement rather than a
permanent anonymous quick tunnel. [Cloudflare quick tunnel documentation](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

## Rollback

Stop `cloudflared` with Ctrl+C. Restore the LAN URL and restart Expo if needed.
In Administrator PowerShell, remove only the rules/mapping created above:

```powershell
netsh interface portproxy delete v4tov4 listenaddress=192.168.1.10 listenport=3000
Get-NetFirewallRule -Name 'Kirkit-Phone-3000' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
Get-NetFirewallHyperVRule -Name 'Kirkit-Phone-3000-HyperV' -ErrorAction SilentlyContinue | Remove-NetFirewallHyperVRule
Get-NetFirewallHyperVRule -Name 'Kirkit-NAT-3000-HyperV' -ErrorAction SilentlyContinue | Remove-NetFirewallHyperVRule
```

## Verification status

The restricted agent environment cannot open sockets (`Operation not permitted`)
and cannot launch Windows PowerShell interoperability (`UtilBindVsockAnyPort`).
Therefore Windows rules and live backend/phone connectivity were not modified or
verified here. Local typecheck/lint and URL regression tests can run. Actual
success requires the phone browser health response, then signup/login in Expo Go.

## Repeatable daily startup (after the working NAT setup)

Windows keeps portproxy/firewall rules across restarts, but their destination can
become stale when WSL's IP changes. The laptop's Wi-Fi IP can also change. After
starting the backend in WSL, run this in **Administrator Windows PowerShell**:

```powershell
& '\\wsl.localhost\Ubuntu\home\ashish_pundir\projects\kirkit\scripts\refresh-wsl-network.ps1'
```

The helper checks backend readiness, refreshes the current Wi-Fi-to-WSL mapping
and the existing `Kirkit-Dev-3000` firewall rule, and updates only
`EXPO_PUBLIC_API_URL` in `mobile/.env`. It requires the Wi-Fi profile already to be
Private; it never automatically trusts a new network. It does not start the
backend, restart Expo, open database ports, or set global firewall policy.
Existing mappings for older Wi-Fi addresses are left untouched; delete obsolete
Kirkit mappings explicitly using `netsh interface portproxy delete v4tov4` with
that old listen address and port 3000 if changing networks.

If Windows blocks this local script under its execution policy, review the file
and launch it with a process-only policy override (no permanent policy change):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File '\\wsl.localhost\Ubuntu\home\ashish_pundir\projects\kirkit\scripts\refresh-wsl-network.ps1'
```

Then start/restart Expo in WSL with `npx expo start --tunnel --clear` from `mobile`.
Keep the backend and Expo running. Verify health on the phone after a network
change. Guest Wi-Fi/client isolation, VPN changes, or managed firewall policies
can still prevent LAN connectivity. This helper was reviewed but could not be
executed from the agent's restricted environment; the preceding manual setup was
reported working by the user.
