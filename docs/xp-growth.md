# Visible experience and level growth

2026-11-19: Homepage now shows current level, equipped automatic title, remaining XP and an always-visible experience bar. The title collection unlocks at levels 1, 5, 10, 15, 20 and each subsequent multiple of five. Unlocks derive from accumulated XP and use the existing progress/account synchronization; no separate scoring or reward writes are introduced.

Correct-answer feedback adds a short XP pop and a compact animated level progress bar. Home and lesson completion show XP earned in the session and a settlement bar from session starting XP through the earned amount. The bar fills each crossed level before continuing on the next. Level and title unlock messages remain visible, and reduced motion presents the final state immediately. Animations never block Next or completion navigation and never mutate learning state.

Fixed an existing homepage level-curve mismatch: the server requires 50, 80, 110… XP per level, whereas the old homepage repeated 50 for the second level. Client presentation now agrees with the production server for all 99 levels. Existing XP totals remain unchanged. Historical users may therefore see a corrected level number.

Validation includes production threshold parity, exact crossings, multiple levels, zero XP, level 99, title unlocks, generated runtime consistency and full unit suite. Browser acceptance covers answer progress, home/lesson settlement, repeated animation without duplicate awards, title collection and deterministic level-five title unlock, in mobile and desktop Chrome. Authenticated live account synchronization is unchanged and is not exercised by offline browser acceptance.
