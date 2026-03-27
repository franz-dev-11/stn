# Supabase Avatar Storage Setup

This guide walks through setting up the avatars bucket for profile photo uploads.

## Option 1: Automatic Verification (No Setup Required)

The app checks if the avatars bucket exists on startup and logs helpful warnings if it's missing.

```javascript
// Already integrated in App.jsx
import { initializeAvatarStorage } from "./utils/avatarStorage";

useEffect(() => {
  initializeAvatarStorage().catch((err) => {
    console.warn("Avatar storage verification warning:", err.message);
  });
}, []);
```

This will:

- ✅ Verify the `avatars` bucket exists
- ✅ Log warnings if it's missing
- ✅ Continue normally (non-blocking)

**Note:** Bucket creation and RLS policies must be set up manually (see Option 2 below) because they require admin/service role permissions.

---

## Option 2: Manual Setup (Via Supabase Console) — REQUIRED

### Step 1: Create the Bucket

1. Log in to your [Supabase Dashboard](https://app.supabase.com/)
2. Navigate to **Storage** in the left sidebar
3. Click **Create a new bucket**
4. Name it: `avatars`
5. Make it **Private** (not public; we'll use public URLs with RLS)
6. Click **Create bucket**

### Step 2: Enable RLS (Row Level Security)

1. Click the three dots next to the `avatars` bucket
2. Select **Edit policies**
3. You should see RLS is enabled. If not, enable it.

### Step 3: Add RLS Policies

Create two policies:

#### Policy 1: Allow authenticated users to upload avatars

```sql
CREATE POLICY "Users can upload their own avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');
```

#### Policy 2: Allow authenticated users to read all avatars

```sql
CREATE POLICY "Authenticated users can read avatar images"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');
```

---

## Environment Variables

Ensure your `.env` file contains:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_AVATAR_BUCKET=avatars
```

The app defaults to `avatars` if `VITE_SUPABASE_AVATAR_BUCKET` is not set.

---

## Troubleshooting

### "[Avatar Storage] Bucket 'avatars' not found"

**This means the bucket hasn't been created yet.**

1. Follow **Option 2** above to manually create the bucket via Supabase console
2. Make sure to also add the RLS policies (Step 3)
3. Refresh your app — the warning should disappear

### "Bucket creation failed: new row violates row-level security policy"

**This is expected.** Bucket creation requires service role permissions (admin), which authenticated users don't have. You must:

1. Create the bucket manually via Supabase Dashboard (see Step 1 in Option 2)
2. Add RLS policies manually (see Step 3 in Option 2)
3. The app will detect the bucket exists and continue normally

### Photo uploads but doesn't display

**Most likely cause: RLS policies are blocking read access.**

1. Open Supabase Dashboard → **Storage** → **avatars** bucket
2. Click the three dots → **Policies**
3. Verify you have **two** policies:
   - "Users can upload their own avatar" (INSERT policy)
   - "Authenticated users can read avatar images" (SELECT policy)

4. If policies are missing, add them from **Step 3** in Option 2
5. Refresh your app and try uploading again

**Alternative: Check if file was actually uploaded:**

1. In Storage → avatars bucket, you should see a folder with your user ID
2. Inside that folder, there should be a `profile.jpg` file
3. If you don't see it, the upload failed (check browser console for errors)

**Browser console debugging:**

1. Open Developer Tools (F12)
2. Go to **Console** tab
3. Try uploading a photo — look for error messages
4. If you see "Permission denied" or "403 Forbidden", it's an RLS policy issue

---

## Testing

1. Navigate to Profile page (`/profile`)
2. Click "Choose File" and select an image
3. Click "Save Photo"
4. You should see a success message
5. Sidebar avatar should update immediately
6. Refresh the page to confirm it persists

---

## File Locations

- **Profile page:** `src/pages/Profile.jsx`
- **Avatar helper:** `src/utils/avatarStorage.js`
- **Sidebar component:** `src/components/Sidebar.jsx`
