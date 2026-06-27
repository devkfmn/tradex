# Firebase Security Rules

These rules ensure each authenticated user can only read and write their own
data. Copy them into the Firebase console (or your `firestore.rules` /
`storage.rules` files) and publish.

## Firestore rules

Console: **Firestore Database -> Rules**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Everything a user owns lives under /users/{userId}/...
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null
                         && request.auth.uid == userId;
    }

    // Deny everything else by default.
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## Storage rules

Console: **Storage -> Rules**

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    // Screenshots live under users/{uid}/trades/{tradeId}/{filename}
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null
                         && request.auth.uid == userId;
    }
  }
}
```

### Optional hardening for Storage uploads

To limit uploads to images under ~10 MB, replace the `write` line above with:

```
allow read: if request.auth != null && request.auth.uid == userId;
allow write: if request.auth != null
             && request.auth.uid == userId
             && request.resource.size < 10 * 1024 * 1024
             && request.resource.contentType.matches('image/.*');
```

## Notes

- Auth is required for all access; unauthenticated requests are denied.
- `request.auth.uid == userId` scopes every read/write to the signed-in user.
- The app never reads or writes outside `users/{uid}/...`.
