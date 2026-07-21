<!-- managed:linked-repos -->
## Linked Repositories
- wisemankelli-dev/stitchwise-studio
<!-- /managed:linked-repos -->

# StitchWise Studio Code Workflow

## Repository
Primary: `wisemankelli-dev/stitchwise-studio`

## Mandatory: Commit + Push Every Change (CRITICAL)
**Every code change must be committed and pushed to GitHub before moving on.** The sandbox can crash without warning, and when it does, only code on GitHub survives. There is no recovery of uncommitted work.

Rule: commit → push after EVERY meaningful change. No exceptions. Do not batch work and "push at the end."

## Sandbox Stability Rules (CRITICAL)
The sandbox has **3.8GB RAM with 2GB swap**. Memory exhaustion causes crashes that wipe uncommitted work. Follow these rules strictly:

1. **Never run a build and a dev server at the same time.** Stop the dev servers (`kill` the Vite + proxy + backend processes) before running `tsc`, `npm run build`, or `npm install`.

2. **Cap build parallelism.** Use `NODE_OPTIONS="--max-old-space-size=512"` and limit jest to `--maxWorkers=2`. Do not run default-parallel builds.

3. **Commit early, push immediately.** Every meaningful change → `git add` → `git commit` → `git push`. If the sandbox crashes, only committed code survives.

4. **Swap is pre-configured** in `/home/team/shared/start.sh`. If the sandbox is reset, run `sudo swapon /swapfile` before doing anything else.

## Initialization
1.  **Backend**: Push `stitchwise-backend` and `stitchwise-stitch-service` as subdirectories in the `main` branch.
2.  **Frontend**: Push `client-portal` as a subdirectory in the `main` branch.
3.  **QA**: Push `stitchwise` (tests) as a subdirectory in the `main` branch.

## Feature Development
- Create a feature branch from `main`.
- Commit changes and push to the remote.
- Open a Pull Request (PR) for the Lead to review.
- PRs must pass linting and initial tests.

## Review & Merge
- Lead reviews the PR.
- Once approved, the Lead merges the PR into `main`.