# GRVD DAW — Daily Git Workflow

This is your everyday guide. Read it once, bookmark it, come back when you forget a command.

## The mental model

You have **three places** your code lives:

1. **`main`** on GitHub — the deployable version. Vercel auto-deploys from here. Treat it like production. You never work directly on main.
2. **`dev`** on GitHub — your daily working branch. This is where you experiment, add features, break things.
3. **`feature/<name>`** branches — short-lived branches for bigger changes you're nervous about. Merge them into `dev` when they work.

Why this split? Because "main" is always safe. If you break `dev`, `main` still works — Vercel keeps serving the last good version. If you break `feature/foo`, you just delete the branch. No damage.

## The golden rule

**Every time you sit down to code, pull first.** This makes sure you're starting from the latest code.

```bash
cd ~/grvd/daw-v2
git checkout dev
git pull
```

## The everyday loop

```bash
# 1. Start your session — always on dev
cd ~/grvd/daw-v2
git checkout dev
git pull

# 2. Work on code, save files (edit in VS Code, Cursor, whatever)

# 3. See what you changed
git status              # which files changed
git diff                # line-by-line changes

# 4. Save a checkpoint (commit). Commit OFTEN — small commits are easier to undo.
git add -A
git commit -m "short message about what you did"

# 5. Push to GitHub so your work is backed up
git push
```

**Commit messages.** Keep them short and in the present tense. Good examples:

- `fix: vocal recording silent on Scarlett`
- `feat: add swap button to mixer`
- `refactor: clean up engine.ts imports`
- `docs: update handoff notes`

Bad examples: `stuff`, `asdf`, `changes`. Future-you will be mad at past-you.

## Trying something risky? Use a feature branch

When you're about to do something you're nervous about (big refactor, new dependency, experimental UI):

```bash
# create + switch to a feature branch off dev
git checkout dev
git pull
git checkout -b feature/new-drum-machine

# …work, commit, push as usual…
git add -A
git commit -m "wip: drum machine prototype"
git push -u origin feature/new-drum-machine
```

If it works, merge it back into `dev`:

```bash
git checkout dev
git pull
git merge feature/new-drum-machine
git push
git branch -d feature/new-drum-machine                 # delete local branch
git push origin --delete feature/new-drum-machine      # delete remote branch
```

If it doesn't work, just throw it away:

```bash
git checkout dev
git branch -D feature/new-drum-machine                 # delete local (forced)
git push origin --delete feature/new-drum-machine      # delete remote
```

No harm done. `dev` is untouched.

## Shipping to production (dev → main)

When `dev` is stable and you want Vercel to deploy it:

```bash
git checkout main
git pull
git merge dev
git push
```

That's it. Vercel picks up the push and redeploys.

> **Better habit when you're ready:** open a Pull Request on GitHub.com instead of merging directly. PRs let you review the diff one more time before it goes live, and they're the industry-standard way to ship. See `GITHUB_SETUP.md` for how to require PRs.

## Tagging versions (milestones you can return to)

When something major works and you want a permanent marker:

```bash
git tag -a v0.2.0 -m "vocal recording works everywhere"
git push origin --tags
```

Version numbers go `vMAJOR.MINOR.PATCH`:

- Bump `PATCH` for bug fixes: `v0.1.0` → `v0.1.1`
- Bump `MINOR` for new features: `v0.1.1` → `v0.2.0`
- Bump `MAJOR` for big breaking changes: `v0.9.0` → `v1.0.0`

## OH NO, I broke everything

These are the most valuable commands you'll ever learn. Bookmark them.

### "I haven't committed yet and I want to throw away my changes"

```bash
git restore .
```

Nukes all unsaved changes in tracked files. Back to the last commit.

### "I committed something broken, I want to undo the last commit but keep the changes"

```bash
git reset --soft HEAD~1
```

Moves the commit pointer back by 1. Your files stay changed. You can re-commit differently.

### "I committed and pushed something broken to dev"

Don't panic. Revert creates a NEW commit that undoes the bad one:

```bash
git revert HEAD           # undoes the most recent commit
git push
```

### "I want to go back to a previous version completely"

Use the tag you created earlier:

```bash
git checkout v0.1.0       # time-travel to that version (read-only)
```

To make it the new state of main:

```bash
git checkout main
git reset --hard v0.1.0   # DANGER: wipes everything after v0.1.0
git push --force-with-lease
```

**Only do this if you're sure.** `--force-with-lease` is safer than `--force` because it refuses to overwrite if someone else pushed.

### "I accidentally committed a secret (API key, password)"

1. **Rotate the secret immediately** — assume it's already leaked. Go to the service (Supabase, Vercel, whatever) and generate a new one.
2. Tell me (Claude) and I'll help you scrub it from git history.
3. Never commit `.env` or `.env.local` — they're in `.gitignore` for a reason.

## Cheat sheet

```
git status                       # what's going on right now
git diff                         # what have I changed (unstaged)
git diff --staged                # what's about to be committed
git log --oneline -10            # last 10 commits
git branch                       # what branches exist locally
git branch -a                    # local + remote branches
git checkout <branch>            # switch to an existing branch
git checkout -b <branch>         # create + switch to a new branch
git merge <branch>               # merge <branch> into current branch
git pull                         # fetch + merge remote changes
git push                         # send your commits to GitHub
git push -u origin <branch>      # push a new branch for the first time
git tag -l                       # list all tags
git stash                        # temporarily shelve changes
git stash pop                    # bring them back
```

## When in doubt

Stop before doing anything destructive (`reset --hard`, `push --force`, `branch -D`).
Ask. The worst case is extra typing. The worst case of guessing is losing a day's work.
