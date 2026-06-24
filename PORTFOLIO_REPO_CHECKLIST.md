# Portfolio Repository Checklist

This checklist is for publishing this project as a clean, single-maintainer portfolio repository.

## 1. Create New Repository

- Suggested repository name: `estatechain-marketplace`
- Visibility: `Public`
- Initialize with: **no README, no .gitignore, no license** (already included here)

## 2. Push Current Code

```bash
git remote rename origin source-origin
git remote add origin https://github.com/MuhammadAamirGulzar/estatechain-marketplace.git
git branch -M main
git push -u origin main
```

## 3. Repository Settings

- Keep only one maintainer (you).
- Remove all collaborators/teams from Settings > Collaborators.
- In Settings > General, set About description to:
  `Full-stack real estate tokenization marketplace with blockchain-backed ownership, KYC, investments, and secondary trading.`
- Add topics:
  `rwa`, `real-estate`, `tokenization`, `blockchain`, `solidity`, `react`, `nodejs`, `web3`

## 4. Branch Strategy

- Keep only `main` unless an active release branch is required.
- If any extra branches are pushed later, delete stale branches.

## 5. Compliance and Safety

- License is non-commercial (PolyForm Noncommercial 1.0.0).
- Do not commit `.env` files or private keys.
- Rotate any credentials that were ever exposed.

## 6. Optional Portfolio Enhancements

- Add architecture diagram screenshots to README.
- Add demo video link and deployment URL.
- Add release tags (`v0.1.0`, `v0.2.0`, etc.) for milestones.
