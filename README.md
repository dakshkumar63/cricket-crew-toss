# Cricket Crew Toss

An offline-friendly cricket team maker for mobile.

## What it does

- Enter 2 to 40 players.
- Assign each player a number and optional name.
- Randomly selects two captains.
- Randomly splits the remaining players into Team A and Team B.
- If the player count creates one extra player, the app marks that player as the "Both / extra player".
- Tosses randomly and chooses Bat or Ball.
- Saves each generated match with date and time.
- Lets you submit Team A runs, Team B runs, and the winner.
- Locks the final score after submission.
- Shows public match history when Firebase Firestore is connected.
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

## Online match history setup

GitHub Pages can host the app, but it cannot store shared match data by itself. To make saved matches visible to everyone, connect Firebase Firestore.

1. Go to Firebase Console and create a project.
2. Add a Web app.
3. Copy the Firebase config object.
4. Open `firebase-config.js`.
5. Replace the empty values with your Firebase values.
6. In Firebase, create a Firestore database.
7. In Firestore Rules, paste the contents of `firestore.rules` and publish.
8. Upload these updated files to GitHub:

```text
index.html
styles.css
app.js
firebase-config.js
firestore.rules
manifest.webmanifest
sw.js
assets/icon.svg
README.md
```

After that, every friend using the GitHub Pages link will see the same public match history.
