# Start Kirkit on your phone with Expo Go

Use this routine on your Windows + WSL setup. Your backend and Expo run in WSL;
one Windows Administrator command makes the backend and Expo reachable from your
phone over your local network. This routine does not depend on an Expo tunnel.

## Before starting

- Connect the laptop and phone to the same trusted Wi-Fi, or connect the laptop
  to the phone's hotspot.
- Keep that Windows Wi-Fi network profile set to **Private**.
- Have Expo Go installed on the phone.
- First-time setup for the offline update: in a WSL terminal run the command
  below from `mobile/`. It installs the versions that match this Expo SDK and
  refreshes `package-lock.json`. Do this once when the network is available.

```sh
cd /home/ashish_pundir/projects/kirkit/mobile
touch /tmp/kirkit-empty-global.npmrc
NPM_CONFIG_USERCONFIG=/dev/null NPM_CONFIG_GLOBALCONFIG=/tmp/kirkit-empty-global.npmrc npx expo install expo-sqlite expo-secure-store expo-print expo-sharing expo-file-system expo-network expo-crypto
```

The temporary npm config paths avoid a WSL `~/.npmrc` `allow-scripts` setting
being forwarded by `npx` into Expo's nested project install. This affects only
that command; it does not change your npm configuration files.

- Have the project dependencies installed before starting.

Cricket matches now save to SQLite on the phone. The backend is used for sign-in
and sign-up; normal scoring does not need Neon or a reachable backend. Existing
Neon matches remain in place. See [the offline-first guide](docs/OFFLINE-FIRST.md)
if you need to copy those matches onto a new phone.

## 1. Start the backend — WSL terminal

```sh
cd /home/ashish_pundir/projects/kirkit/backend
npm run dev
```

Wait for:

```text
PostgreSQL connection verified.
Backend listening on port 3000.
```

**Leave this terminal running.** If the backend is already running, do not start
another copy.

## 2. Refresh phone access — Windows PowerShell as Administrator

On Windows, open Start, search for **PowerShell**, right-click it, and choose
**Run as administrator**. This command must run in Windows PowerShell, not WSL.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "\\wsl.localhost\Ubuntu\home\ashish_pundir\projects\kirkit\scripts\refresh-wsl-network.ps1" -ExpoLan
```

The helper:

- Checks that the backend is ready.
- Detects the laptop and WSL IP addresses.
- Refreshes forwarding for backend port 3000 and Expo port 8081, with firewall
  rules limited to the Private Wi-Fi profile and local devices.
- Updates `EXPO_PUBLIC_API_URL` in `mobile/.env`.
- Prints the health-check URL and the exact Expo command with your current IP.

The execution-policy override applies only to this PowerShell process. It does
not permanently change Windows execution policy. The helper does not expose your
database or disable the firewall.

If it says the network is not Private, change the Wi-Fi network profile to
**Private** in Windows Settings, only if it is your trusted Wi-Fi/hotspot, then
rerun the command.

## 3. Check the backend — phone browser

Open the URL printed by the helper, for example:

```text
http://YOUR_CURRENT_LAPTOP_IP:3000/health
```

Use the actual printed IP, not the placeholder above or an old saved IP.

Expected response:

```json
{"status":"ok","database":"connected"}
```

If this does not work, stop here and check the helper's output. Restarting Expo
will not fix a backend URL that the phone browser cannot reach.

## 4. Start Expo — a second WSL terminal

If an old Expo process is running, stop it with **Ctrl+C** first.

```sh
cd /home/ashish_pundir/projects/kirkit/mobile
# Run the exact REACT_NATIVE_PACKAGER_HOSTNAME=... command printed by step 2.
```

For example, if the helper prints a laptop IP of `10.250.117.195`, the command is:

```sh
REACT_NATIVE_PACKAGER_HOSTNAME=10.250.117.195 npx expo start --lan --go --port 8081 --clear
```

Use the helper's current IP, not an old saved IP. Keep port 8081; if Expo says it
is occupied, stop the old Expo process instead of selecting a different port.

**Leave this terminal running too.** In your phone browser, open the helper's
`http://YOUR_CURRENT_LAPTOP_IP:8081/status` URL. It should show
`packager-status:running`. Then scan the QR code in Expo Go. The QR must contain
your laptop's Wi-Fi IP, not WSL's `172.*` IP or localhost.

An Android SDK/ADB warning can be ignored for this Expo Go QR-code workflow.
You do not need Android Studio or an emulator for it.

If you prefer the Expo tunnel later, start with `npx expo start --tunnel --clear`.
Tunnel errors such as `session closed` or `remote gone away` mean the tunnel
connection failed; the local-network routine above avoids that dependency.

## 5. Open and test the app — phone

1. Open Expo Go and scan the QR code printed by Expo.
2. On the login screen, expand **Connection help**, then tap **Check connection**.
3. Sign up or log in using a development account. This step needs the backend.
4. Create a match and score it. Matches, teams, undo, history, and scorecards
   are stored on the phone and continue working when the backend or internet is
   unavailable. Keep Expo's Metro server running while testing in Expo Go.

The development login screen displays the API address inside **Connection help**. It should match the
address printed by the helper, without `/health`.

## While developing

Keep both WSL terminals running: **backend** and **Expo**. The PowerShell helper
finishes and does not need to stay open.

- Backend changes restart automatically through `npm run dev`.
- If WSL restarts or the Wi-Fi/hotspot changes, start the backend again if needed,
  then repeat steps **2–5**. IP addresses can change.
- Do not manually reuse an old API IP; the helper updates it for you.
- Use test accounts on your trusted network. The local API connection uses HTTP.

## When finished

Press **Ctrl+C** in the backend and Expo terminals. Windows keeps the forwarding
and firewall rules; the helper refreshes them on your next development session.

## Quick troubleshooting

| Problem | What to do |
| --- | --- |
| `npm` says `package.json` is missing | Run the `cd` command for the backend or mobile folder before the npm command. |
| Port 3000 is already in use | Keep the existing backend if it is healthy, or stop it before starting another copy. |
| Helper cannot reach the backend | Check the backend terminal for startup errors; verify it is listening before rerunning the helper. |
| Helper says access denied | Open **Windows PowerShell as Administrator**. |
| Phone browser cannot open `/health` | Check the same Wi-Fi/hotspot, the Private network profile, and rerun the helper. Guest Wi-Fi, VPNs, or device isolation can block access. |
| Phone browser works, but the app cannot connect | Stop Expo, rerun step 4, and reload the app so it picks up the updated API URL. |
| Health works, but signup/login returns an HTTP error | The network is connected. Check the error shown by the app and the backend terminal. |

For detailed networking diagnostics, see [the phone connectivity guide](docs/PHONE-CONNECTIVITY.md).
