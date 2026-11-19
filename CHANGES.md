# BabyNames v3.2: getting back in without an email

## Do this once
1. **Supabase SQL editor:** run `supabase/v3.2-recovery.sql`. Keeps your data. Adds a `recovery_codes` table and three functions.
2. Build and deploy as usual.

## What's new
- **Recovery code** (Settings → "If you lose this phone", shown only when no email is saved). Makes a 12-letter code like `K7QM-2XPA-9RTD`, shown once, with Copy and Save to… buttons. Only a hash is stored and no phone can read that table, so your partner can't see or use your code. Making a new one kills the old one; using one kills it too.
- **New phone:** "I've used BabyNames before" → "I have a recovery code" moves your old spot, answers, This or That picks and added names onto the new phone's account.
- The Discover nudge now says "Save an email or recovery code" and hides once you've made a code.
- **Lost account with no email and no code:** if your partner still has the app, "Let them back in" (v3.1) still works. If not, `supabase/recover-account-manually.sql` walks you through moving it by hand in the SQL editor.

# BabyNames v3.1: fixes from the round-3 stress test

Findings are in `babynames-review/round3/` (SUMMARY.md). This is everything from "fix first", the fun fixes, and the P1 text cuts.

## Do this once
1. **Supabase SQL editor:** run `supabase/v3.1-update.sql`. It keeps your data. It adds one column to `swipes`, two to `sessions`, the `allow_rejoin` function and a new `join_session`. (`schema.sql` has the same changes for a fresh start, but running it drops everything.)
2. `npm run build`, then `npm run deploy` as usual.

## Bugs fixed
- **Android back** goes back a screen instead of closing the app. Each screen has its own address now (`/deck/today`, `/names`, `/settings`…), and the Worker's SPA fallback serves them.
- **Offline data loss:** added names, Girl/Boy tags and This or That picks go through the same outbox as answers, so they send when you're back online and a refresh no longer wipes them.
- **New phone with no saved email:** your partner opens Settings → "Taylor got a new phone?" → **Let them back in**. For 15 minutes, joining with the code takes over the old spot, answers and all. The "list is full" and "no list under that email" messages point there. Discover also shows a dismissable "Add a backup email" row once you have a match.
- **Couch mode:** leaving ends it for both of you, and the other phone shows "Taylor ended Couch mode" with the tally instead of a blank start screen. If you finish first, your partner can keep going. Starting it offline shows an error instead of a game only you can see.
- **Finished packs** deal new names instead of reopening their old summary.
- **Both say yes at the same moment:** "It's a match!" still shows, even when your partner's yes lands a second later.
- **Double taps:** a quick second tap can no longer answer the card underneath. Pressing an arrow key three times no longer leaves extra undo steps.
- **Invite link when you'd already started a list** opens Settings with their code filled in to join theirs.
- Smaller fixes: names your partner adds (including listed ones like Jaxson → Jackson) really do come first in your Today's 10. A filter change on one phone re-deals stacks on the other. The summary says how many of your yeses your partner hasn't seen. My answers' pills aren't clipped. "Yes" in My answers no longer counts Loves twice. Long names wrap on the card. Names in other scripts (Сергей) can be added. An empty first name isn't saved. The drag distance on the unfolded Fold matches the card, and the tab bar no longer stretches 900px.
- **Privacy:** your partner's yeses no longer land on cards 3, 6 and 9. Where they go is random per phone. I also improved the shuffle, which was clustering similar keys.

## More fun
- **Weekly streak:** counts weeks in which you both played, shown as "🔥 3 weeks" on Discover only. Nothing nags.
- **Catch up** shows "10+ new" instead of a count that grows to 695.
- **Couch mode** mixes in up to 5 names one of you already said yes to and the other hasn't seen, scattered through the 20 (never first or second). The one who liked it is asked again, so the reveal is fair. Tapping Couch on Discover starts straight away; the intro screen is gone.
- **Add a name:** keep your spelling ("Want it spelled Anika?"), and a ♥ button adds it as a Love.

## Cut (from ux.md, P1 plus a few cheap P2s)
- Small-caps eyebrows everywhere. The five repeats of "Taylor can't see this". Create list's "Show me" (it's in Settings), placeholders and hints.
- Summary: matches first, then "Also yes: …", no streak, no duplicate list.
- Couch: intro screen, avatars, running tally, "Leave" vs "End" (just "End").
- Discover: one-row "Your partner hasn't joined · Share code". No "Packs" header, most pack subtitles, counts over 50. Origins are chips.
- Our names: empty-state box, link subtitles, Our order caption, A–Z sort (so Our order fits on screen).
- Name page: You/Taylor answer boxes on matches (replaced by "★ Taylor loves it" when it applies), the last-name card (now one line), "We don't have a meaning". The take-off sheet warns when your partner loved it.
- Card: popularity word and syllables. Initials only show when they spell something.
- Settings: no Partner row, shorter copy, "Backup email" instead of "Keep your answers safe".

Not done (still open): partners can read each other's no's in the database; Couch still reveals each No; the summary after "10 more" covers only the last 10; the P2/P3 cuts that remove features (Clear my answers, My yes list in This or That). Reloading on a deep link like `/deck/today` works.

---

# BabyNames v3: what changed and how to run it

v3 is a **web app first**. You both open it in Chrome on Android and tap Install (or ⋮ → Add to Home screen), and it runs full screen like a normal app. The same code can still become a Play Store app later.

## Setup
1. **Supabase SQL editor:** run `supabase/schema.sql`. It **drops every earlier BabyNames table** and starts fresh.
2. **Supabase → Authentication → Sign In / Providers:** turn on **Allow anonymous sign-ins** and keep **Email** on.
3. **Supabase → Authentication → Email Templates:** in **Magic Link** and **Change Email Address**, add `{{ .Token }}` so the email shows a 6-digit code.
4. Delete the old files listed under "Removed files" below.
5. `npm install`, then `npm run web` to try it at http://localhost:8081.

## Deploy (Cloudflare Workers, same as SouperBowl)
- `npm run deploy` builds into `dist/` and uploads it with `wrangler.jsonc`.
- `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are read **at build time**. Locally they come from `.env`. If you build on Cloudflare (Workers Builds from GitHub), add them as **build variables**, not runtime variables.
- Open the site on both phones, then Settings → Install BabyNames (or Chrome ⋮ → Install app).

## What's new
**Discover tab** replaces the endless deck.
- **Today's 10:** a new short stack every day. Names your partner typed in come first. Both of you get mostly the same ten.
- **Catch up with {partner}:** every name they've answered that you haven't, yeses and no's mixed so the pack doesn't give their answers away.
- **Second look:** your no's from 30+ days ago, if you want to reconsider.
- **Packs:** Top 100, Rising, Family classics, Short & strong, Gender-neutral, Nature & virtue, Rare finds, plus 13 origin packs (South Asian, Celtic, Hebrew & Biblical…). Each tile shows how many are left.
- Every stack is 10 names with a progress bar, and ends with a summary: your yeses, new matches, how many your partner hasn't seen yet, and the streak.
- **Shared streak:** a day counts when you both answer at least one name.
- Cards never say what your partner answered. Their yeses are quietly mixed in every third card so matches come sooner.
- Paper-deck cards: drag or tap No / Love / Yes, undo in the corner, arrow keys work on a keyboard. "It's a match!" pops up only after you answer.

**Couch mode** (button at the top of Discover)
- 20 new names, same ones on both phones. Each of you answers, then both answers flip over at once. Ends with tonight's tally.
- Starting it shows your partner an invite banner in the app and opens your share sheet so you can text them a link that drops them straight in.

**Our names tab**
- Not ranked. Sort by Recent, A–Z, Girls, Boys. New matches get a NEW tag and the newest one is shown big.
- Each name has a shared **Girl / Boy / Either** setting (defaults from the data), which decides the Girls / Boys views.
- **This or That:** optional head-to-head picks between your names. "Our order" appears only once you've played.
- **+ Add a name you already like:** search 1,847 names or add your own. Counts as your yes.
- **My answers:** every name you've answered, tap one to change it.
- Name page: meaning, origin, 2024 rank, Say it (text to speech), how it sounds with your last name, initials check, both answers, and "Take it off our list".

**Accounts**
- You each type your first name, so the app says "Sam" instead of "your partner".
- Invite links (`?code=ABC123`) fill in the code.
- Settings → **Keep your answers safe:** add an email. On a new phone, "I've used BabyNames before" signs you back into the same list with a 6-digit code.

**Web app details**
- Installable (manifest, icons, service worker for flaky signal). Full height with the mobile address bar (`100dvh`), no pull-to-refresh fighting swipes, vibration on Android.
- Layout caps at 560px wide and centers, so the unfolded Fold doesn't stretch. Packs go to 3 columns there.
- Light and dark mode follow the phone.

**Bigger name list** (3,567 cards, up from 1,847)
- Added the 2024 top 1,000 for boys and girls plus every name given to 5,000+ US babies, which brings in staples like David and Dorothy that were missing.
- Spelling variants share one card: Jackson shows "Also spelled Jaxon, Jaxson, Jaxxon". Searching any spelling finds the card. About 360 cards carry other spellings.
- Meanings were written for the new names. 136 are left blank where I wasn't sure; those cards show when the name was popular ("Most popular in the 1950s", "Rising fast right now") instead of a meaning.

**Cut for now:** middle names (and the family-names list), agree %, full-name voting. Easy to add later.

## Design
One font (Inter) with italic meanings, cream paper, one coral accent. Paper-deck swiping and full-bleed lists from the mockups you picked.

## Removed files (delete these)
- `src/store/useSessionStore.ts` (replaced by `src/store/useStore.ts`)
- `src/screens/SwipeScreen.tsx`, `src/screens/OurListScreen.tsx`
- `src/components/NameCard.tsx`, `src/components/MatchSheet.tsx`, `src/components/NameSearch.tsx`, `src/components/Tutorial.tsx`
- `src/lib/share.ts`

## Tested
In Chromium at phone size (384×824), unfolded-Fold size (904×1000) and dark mode, against a fake Supabase: create list, invite link join, Today's 10 with drag and buttons, match pop-up, stack summary, Our names sorts, Girl/Boy tag, This or That, add a name, My answers, Couch mode reveal, settings, offline answers + undo syncing after reconnect, email recovery. Also the production build (`npm run build`). **Not yet tested on a real Supabase project or your actual phones.**
