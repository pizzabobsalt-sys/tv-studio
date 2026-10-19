TV Studio web app: upload ALL of these files to the ROOT of one site (no subfolders):
  index.html  manifest.webmanifest  sw.js  icon-180.png  icon-192.png  icon-512.png
Then open the site URL in Safari -> Share -> Add to Home Screen.
After you change index.html later, also bump VER in sw.js so devices fetch the new version.
