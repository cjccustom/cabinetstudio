# CJC Room Scan

A small iPhone / iPad app that scans a room with the LiDAR scanner (Apple's RoomPlan, built into
iOS, no subscription) and saves the walls, doors and windows for Cabinet Studio.

Needs an iPhone 12 Pro or later Pro, or an iPad Pro, on iOS 17 or later.

## Put it on your iPhone (first time, about 30 minutes, mostly waiting for Xcode)

1. **Install Xcode** from the Mac App Store (free, large download). Open it once and let it
   finish installing its parts.
2. **Sign in:** Xcode → Settings → Accounts → **+** → Apple ID. Your normal Apple ID is fine.
3. **Get the app folder:** on github.com/cjccustom/cabinetstudio, click **Code → Download ZIP**,
   open the ZIP, and find `scanner/CJC Room Scan.swiftpm`.
4. **Open it:** double-click `CJC Room Scan.swiftpm` (or drag it onto Xcode).
5. **Plug in the iPhone** with a cable. On the iPhone, tap **Trust** if asked.
6. **Turn on Developer Mode** on the iPhone: Settings → Privacy & Security → Developer Mode → On.
   The phone restarts.
7. In Xcode, at the top, choose your **iPhone** as the run destination. Then click the app name in
   the left column, open **Signing & Capabilities**, and pick your name under **Team**.
8. Press **▶ Run** (or ⌘R). The first time, the iPhone may say the developer isn't trusted:
   Settings → General → VPN & Device Management → your Apple ID → **Trust**. Then press Run again.

With a free Apple ID the app stops opening after 7 days; plug in and press Run again. With the
$99/year Apple Developer membership it stays installed and updates come through TestFlight.

## Scanning

1. Type the client and room, tap **Scan the room**, and walk slowly around the room pointing at each
   wall, the floor and the ceiling. Doors and windows are found as you go.
2. Tap **Done**, wait for the finished model, then **Use this scan**.
3. **Send the scan**: save it to the client's Dropbox folder or AirDrop it to the Mac. Two files
   come along: the scan for Cabinet Studio (`.json`) and a 3D model (`.usdz`) you can look at.
4. In Cabinet Studio: **Design → Room → Import room scan**, pick the `.json`, choose which scanned
   wall is the back wall, check the numbers and **Apply**.

Scans are good to roughly an inch or two. Field verify before ordering, as always.
