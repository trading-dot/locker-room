# RAIL — FVCKTHERULES Virtual Locker Room

Static site for `rail.fucktherules.my.id`. Uses the existing Firebase project `fvcktherules-store`, reads the main store catalog from `produk`, stores RAIL presentation settings in `rail`, and uploads images to Cloudinary. Firebase Storage is not used by this project.

## Deploy
1. Upload the contents of this folder to the root of a dedicated GitHub repository.
2. Enable GitHub Pages from the main branch/root.
3. Add custom domain `rail.fucktherules.my.id` in GitHub Pages and configure DNS as GitHub instructs.
4. In Firebase Authentication, add `rail.fucktherules.my.id` to Authorized domains.

## Firestore Rules
Your existing rules already include the required collection rule. Keep your complete existing rules and all other store rules intact:

```javascript
match /rail/{document=**} {
  allow read: if true;
  allow write: if isAdmin();
}
```

The `isAdmin()` function must keep your existing email allowlist. The admin emails must be registered in Firebase Authentication. This project does not require a `railDesigns` collection or Firebase Storage rules.

## Cloudinary setup
1. In Cloudinary, use the existing Cloud Name and an **unsigned upload preset**. Restrict the preset to image uploads and suitable file sizes/formats.
2. Open `admin.html`, sign in with an allowlisted Firebase admin account, enter Cloud Name and Upload Preset, then click **SAVE CLOUDINARY CONFIG**. These two values are saved in that browser's local storage, not Firestore.
3. Upload PNG, JPG, or WebP images up to 8 MB. Never put a Cloudinary API Secret in frontend code.

## Data flow
- Admin selects a product from the main `produk` collection.
- RAIL settings are saved to `rail/{sourceProductId}`.
- Image URLs from Cloudinary are saved under `textures.front`, `textures.back`, `textures.left`, and `textures.right`.
- Main product, checkout, order, and stock data are not modified.

## Prototype limitations
The included garment is a lightweight procedural Three.js preview. The template at `assets/templates/rail-texture-template-2048.png` is a layout guide, not a ready-made UV atlas. Per-panel UV mapping and realistic garment meshes for each product type remain further development work.


## Single atlas workflow
Admin uses one 2048×2048 atlas image, divided into four equal quadrants: FRONT (top-left), BACK (top-right), LEFT SIDE (bottom-left), RIGHT SIDE (bottom-right). Download `assets/templates/rail-single-atlas-template-2048.png`, place artwork in those areas, and upload one image. The public viewer crops each quadrant for its preview surfaces.
