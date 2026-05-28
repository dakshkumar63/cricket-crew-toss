# Cricket Crew Toss

An offline-friendly cricket team maker for mobile.

## What it does

- Enter 2 to 40 players.
- Assign each player a number and optional name.
- Randomly selects two captains.
- Randomly splits the remaining players into Team A and Team B.
- If the player count creates one extra player, the app marks that player as the "Both / extra player".
- Tosses randomly and chooses Bat or Ball.
- Shares teams and toss stats through WhatsApp or the phone share sheet.
- Works offline after opening once from a local or hosted server.

## Run locally

From this folder:

```powershell
node server.mjs
```

Then open:

```text
http://localhost:4175
```

## Mobile install

Host the folder anywhere static, such as GitHub Pages, Netlify, Vercel, or your own phone-friendly local server. Open the link on your phone, then use the browser menu and choose **Add to Home Screen** or **Install app**. After the first load, it is cached for offline use.

## WhatsApp sharing

Use **Share Stats** to send the current teams and toss result. Use **Share App Link** after hosting the app so your group can open the same app link.
