# GRVD DAW — One-time GitHub Website Setup

These steps happen on **github.com**, not in your terminal. Do them once and forget them.

Total time: ~5 minutes.

Open https://github.com/rafael-mocelin/grvd-daw in your browser before starting.

---

## 1. Turn on two-factor authentication (2FA) — 2 minutes

**Why:** Protects your account even if your password leaks. If someone steals your password, they still can't push malicious code to your repo without your phone.

**How:**

1. Click your profile picture (top right) → **Settings**
2. Left sidebar → **Password and authentication**
3. Scroll to **Two-factor authentication** → click **Enable 2FA**
4. Pick **Authenticator app** (download Google Authenticator or Authy on your phone if you don't have one)
5. Scan the QR code with the app
6. Save the recovery codes somewhere safe (password manager, printed copy). **If you lose your phone and don't have these, you're locked out forever.**

---

## 2. Protect the `main` branch — 2 minutes

**Why:** Stops anyone (including you, by accident at 2am) from pushing broken code directly to `main`. Forces changes to go through a pull request where you can review the diff.

**How:**

1. Go to your repo → **Settings** tab (top of the repo page)
2. Left sidebar → **Branches**
3. Click **Add branch protection rule** (or "Add rule")
4. Branch name pattern: `main`
5. Check these boxes:
   - ✅ **Require a pull request before merging**
     - ✅ Require approvals: **0** (you're solo — 1+ makes sense once you have collaborators)
   - ✅ **Require status checks to pass before merging** (skip if you don't have CI yet)
   - ✅ **Do not allow bypassing the above settings** (apply rules to admins too — this is the whole point)
6. Leave the rest at default
7. **Create** (or **Save changes**)

From now on, `git push origin main` directly will be rejected. Push to `dev`, open a PR, merge it. Takes 30 seconds extra. Saves you from the worst kind of mistake.

> **Escape hatch:** you can always uncheck "Do not allow bypassing" if you hit a real emergency. But make that a conscious decision, not a default.

---

## 3. Turn on secret scanning — 1 minute

**Why:** GitHub will automatically scan your commits for things that look like API keys, tokens, passwords. If you accidentally commit a Supabase key, it'll warn you (and in many cases, notify the provider to auto-rotate it).

**How:**

1. Your repo → **Settings** → left sidebar → **Code security**
2. Find **Secret scanning** → click **Enable**
3. Find **Push protection** under the same section → click **Enable**

Push protection is the magic one: if you try to push a commit containing a secret, GitHub will block the push before it reaches the server. You get a chance to remove it first.

---

## 4. (Optional) Make the repo private — 30 seconds

**Why:** If you're not ready to share the source code publicly, flip it to private. You can always make it public later when the product launches.

**How:**

1. Your repo → **Settings** → scroll to the bottom
2. **Danger Zone** → **Change repository visibility** → **Make private**
3. Confirm by typing the repo name

Vercel will still work fine with a private repo (it authenticates through your GitHub account).

---

## 5. (Optional) Add a CODEOWNERS file — later

Once you have collaborators, a `.github/CODEOWNERS` file automatically requests reviews from specific people when their files change. Not needed while you're solo.

---

## After this is done

Your workflow becomes:

```
work on dev → push dev → open PR on GitHub.com → merge PR → main updates → Vercel deploys
```

The PR step takes 10 seconds the first time, 3 seconds after that. It's the single best habit for keeping production safe.

## Opening a pull request (your first time)

1. Push your `dev` branch: `git push`
2. Go to https://github.com/rafael-mocelin/grvd-daw
3. You'll see a yellow banner: "dev had recent pushes — Compare & pull request". Click it.
4. Title the PR (e.g. "Add drum machine"), add a description, click **Create pull request**.
5. On the PR page, click **Merge pull request** → **Confirm**.
6. Click **Delete branch** (GitHub offers this) — cleans up the merged branch.

Back in your terminal:

```bash
git checkout main
git pull              # pulls the merge commit from the PR
```

You're ready for the next cycle.
