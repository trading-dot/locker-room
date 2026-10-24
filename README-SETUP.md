# RAIL — FVCKTHERULES Virtual Locker Room

Standalone static site intended for `rail.fucktherules.my.id`. It uses the existing Firebase project `fvcktherules-store` and reads products from `produk` and RAIL designs from `railDesigns`.

## Deploy
1. Create a new GitHub repository for the RAIL site.
2. Upload the CONTENTS of this folder to the repository root (not the parent project folder).
3. Enable GitHub Pages from the main branch/root.
4. Add custom domain `rail.fucktherules.my.id` in GitHub Pages and configure the DNS CNAME as GitHub instructs.
5. In Firebase Authentication, add `rail.fucktherules.my.id` to Authorized domains.

## Firebase setup required
### Firestore rules
Add this match inside `match /databases/{database}/documents` before the final closing braces. Keep the existing `isAdmin()` function and admin allowlist intact:

```javascript
match /railDesigns/{designId} {
  allow read: if true;
  allow create, update, delete: if isAdmin();
}
```

### Firebase Storage rules
In Firebase Console > Storage > Rules, add an equivalent rule for `rail-textures`. Keep existing rules intact and merge carefully:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    function isAdmin() {
      return request.auth != null
        && request.auth.token.email in [
          'diasadhityap@gmail.com',
          'fvcktherules3404@gmail.com'
        ];
    }
    match /rail-textures/{allPaths=**} {
      allow read: if true;
      allow write: if isAdmin()
        && request.resource.size < 8 * 1024 * 1024
        && request.resource.contentType.matches('image/(png|jpeg|webp)');
    }
  }
}
```
If Storage already has rules, merge this match into the existing service rather than replacing unrelated rules.

## Important notes
- Admin uses Firebase Email/Password login and the same admin email allowlist as the store rules.
- Admin picks an existing product from the store's `produk` collection and saves a RAIL presentation document to `railDesigns`.
- The source product is referenced by `sourceId`; this does not copy or alter checkout/order data.
- Uploaded textures are stored in Firebase Storage. Keep images under 8 MB.
- `assets/templates/rail-texture-template-2048.png` is a 2048x2048 guide sheet with four labeled art areas. It is a layout guide, not a ready-to-use UV atlas. Current front/back upload inputs are stored on the design record; advanced per-panel UV mapping and realistic garment topology are a next development step.
- The included 3D garment is a lightweight procedural preview built with Three.js, with rotation and front/back/left/right camera presets. It is a working prototype, not yet a photorealistic cloth simulation or exact branded garment mesh.
- Static hosting needs internet access to load Three.js and Firebase modules from their CDNs.
