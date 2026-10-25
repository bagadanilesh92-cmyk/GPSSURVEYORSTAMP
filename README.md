# SurveyStamp

SurveyStamp is a React + TypeScript web app for organizing claim folders and capturing GPS-stamped survey photos.

## Run locally

1. Install Node.js 20 or newer.
2. Open a terminal in this project folder.
3. Run:

   ```bash
   npm install
   npm run dev
   ```

4. Open the local URL printed by Vite.

## Publish using GitHub Pages

1. Create a new GitHub repository.
2. Upload all files/folders in this project to the repository's `main` branch.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, choose **GitHub Actions**.
5. Open the **Actions** tab and wait for **Deploy SurveyStamp to GitHub Pages** to finish.
6. Open the published Pages URL shown in the workflow deployment.

## Important notes

- Camera and location features require permission and a secure context. GitHub Pages uses HTTPS, so it can support these browser APIs on compatible devices.
- The app saves folders and photos in the browser's IndexedDB on that device/browser. This is **not cloud sync**: data will not automatically appear on another phone or computer, and clearing browser site data can remove it.
- Camera, GPS, torch/flash, file sharing and saving directly into the phone's Pictures folder vary by browser/device. Test on the target Android phone.
- This is a web app deployment, not an Android APK.
