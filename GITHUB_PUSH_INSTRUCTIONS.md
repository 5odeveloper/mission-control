# GitHub Push Instructions

## Current State
The code has been pushed to **5odeveloper's fork**:
- 🔗 https://github.com/5odeveloper/mission-control
- Latest commit: `feat: home dashboard, office polish, bottom sheet fix, resources API`

---

## To Fork to `alounpro/mission-control`

Run these commands on your machine (requires `gh` CLI authenticated as `alounpro`):

```bash
# 1. Fork the original repo to alounpro
gh repo fork crshdn/mission-control --clone=false --fork-name mission-control

# 2. Add the alounpro fork as a remote
cd /root/mission-control
git remote add alounpro https://github.com/alounpro/mission-control.git

# 3. Push current state to alounpro fork
git push alounpro main
```

### Or using Git + Personal Access Token (no gh CLI needed):
```bash
cd /root/mission-control

# Create fork via API (replace YOUR_ALOUNPRO_TOKEN with your PAT)
curl -X POST \
  -H "Authorization: token YOUR_ALOUNPRO_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/crshdn/mission-control/forks \
  -d '{"name":"mission-control"}'

# Wait 30 seconds for fork to initialize, then:
git remote add alounpro "https://alounpro:YOUR_ALOUNPRO_TOKEN@github.com/alounpro/mission-control.git"
git push alounpro main
```

---

## Remotes Currently Configured
- `origin`   → https://github.com/crshdn/mission-control.git (upstream source)
- `upstream` → https://github.com/crshdn/mission-control.git
- `fork`     → https://github.com/5odeveloper/mission-control (5odeveloper's fork ✅ pushed)
