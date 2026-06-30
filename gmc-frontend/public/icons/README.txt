Place these two files here before building for production:

  icon-192.png   - 192×192 px  (your GMC logo, square, on dark bg #0a0512)
  icon-512.png   - 512×512 px  (same logo, larger)
  apple-touch-icon.png - 180×180 px (same, iOS home screen icon)

Quick way to generate them from your logo:
  https://realfavicongenerator.net
  Upload "logo png.png", set background #0a0512, download the package.

Without these files the PWA manifest will still work but the
"Add to Home Screen" icon will be blank.
