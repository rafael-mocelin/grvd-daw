# Session Prompts

Copy-paste these into Claude at the end of any coding session.

---

## 1. End-of-session commit helper

```
I just finished a coding session on daw-v2. Please:

1. Run `cd ~/grvd/daw-v2 && git status` in the sandbox and show me the output.
2. Look at what's changed and group the changes into logical commits (one feature or fix per commit). Tell me your proposed grouping first.
3. Give me the exact terminal commands I should paste into my Mac terminal — one block per commit — using `git add <specific files>` (NOT `git add .`) followed by `git commit -m "..."` with a clear conventional-commit message (feat:, fix:, chore:, docs:).
4. At the end, give me the `git push` command for the current branch.
5. IMPORTANT: Use single quotes around commit messages, and avoid `!` `$` `` ` `` characters in the messages (zsh history expansion will bite me). If a message needs one, use `set +H` before it or rephrase.

Do NOT run git commit yourself — I'll run the commands in my terminal.
```

---

## 2. Supervise / verify everything is committed

```
Supervise my git state for daw-v2. In the sandbox, run and show me:

1. `cd ~/grvd/daw-v2 && git status` — any uncommitted changes? untracked files?
2. `cd ~/grvd/daw-v2 && git log --oneline -10` — last 10 commits, so I can sanity-check the story.
3. `cd ~/grvd/daw-v2 && git branch -vv` — which branch am I on, is it tracking the right remote, am I ahead/behind?
4. `cd ~/grvd/daw-v2 && git stash list` — anything stashed I forgot?
5. `cd ~/grvd/daw-v2 && git log origin/$(git branch --show-current)..HEAD --oneline` — unpushed commits on this branch.

Then give me a short verdict:
- Clean, everything committed and pushed, OR
- Here's what's still loose: [list], and here's what to do about each.

Flag anything suspicious: .env files being tracked, large binaries, secrets in diffs, commits on the wrong branch, main being ahead of origin/main without a PR.
```
