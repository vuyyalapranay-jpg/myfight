# Eclipse Blades — Martial Arts Fighting Game

A 2D silhouette martial arts fighting game built with **Vite**, **TypeScript**, **Phaser 3 (Canvas 2D)**, and a **Node.js + WebSocket** 2–16 player Custom Room Tournament server.

## Features
- **14 Original Warriors:** Unique proportions, headgear, armor bulk, weapons, and AI archetypes (`src/systems/WeaponsAndRoster.ts`).
- **9 Weapon Classes:** Swords, Dual Swords, Nunchucks, Tonfas, Knives, Claws, Staffs, Axes, and Spears.
- **Complete Martial Arts Combat:** Jab, hook, uppercut, front/roundhouse/low/jump kicks, weapon combos, crouch, dodge backflip, timed parry, head/body hurtboxes, hit-stop, slow-motion K.O., **F9** hitbox debug overlay, bone-length constrained skeletal arcs, dynamic body lean/knockdown rotation, and white-core slash flashes.
- **6 Game Modes:** Story Campaign (7 chapters + Boss Kaelor), 2–16 Player Custom Room Tournament (full 1st→Nth classification), Survival, Challenges, Quick Duel, and Training Dojo.
- **Progression & Save System:** Persistent `localStorage` save (`eclipse_blades_save_v1`) for XP, level, coins, gems, and 7 upgradeable equipment slots.

## Controls
- **Move:** `A` / `D` or Arrow Left / Right
- **Jump / Crouch:** `W` / `S`
- **Punch:** `U`
- **Weapon Attack / Combo:** `J`
- **Kick:** `K`
- **Block / Timed Parry:** `B`
- **Dodge Backflip:** `Space`
- **Shadow Special:** `L`
- **Hitbox Debug Overlay:** `F9`
- **Mobile / Touch:** On-screen D-Pad and action buttons in the Arena.

## Running Locally
```powershell
npm install
npm run server   # Starts 2-16 player WebSocket tournament server on :3000
npm run dev      # Starts Vite + Phaser 3 client on :5173
```

## Testing & Build
```powershell
npm test         # Runs automated unit tests (node --test)
npm run build    # Type-checks (tsc --noEmit) and builds dist/ for Cloudflare Pages
```

## Cloudflare Pages Deployment
- **Build command:** `npm run build`
- **Build output directory:** `dist`
