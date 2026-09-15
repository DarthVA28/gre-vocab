# GRE Vocab Trainer

A small context-first GRE vocabulary trainer designed for GitHub Pages, with persistent multi-user progress stored in Supabase.

## What is included

- 305 GRE words from the supplied word list
- Contextual hint before the meaning is revealed
- Three piles: New, Review, Confident
- Random practice sessions of up to 10 words
- Per-user counts and progress
- Username + password login
- Persistent state across devices/browsers via Supabase
- No server-side application code; GitHub Pages can host the frontend directly

## 1. Create a Supabase project

Create a project at https://supabase.com/.

In **SQL Editor**, paste and run the contents of `schema.sql`.

## 2. Configure authentication

This first version uses username + password while storing an internal synthetic email such as `ananya@gre-vocab.local` because Supabase password authentication is email/phone based.

In Supabase **Authentication → Providers → Email**, disable the requirement to confirm email addresses. This is appropriate for a small private vocabulary site where the UI intentionally does not collect real email addresses.

## 3. Add your public browser key

Open `config.js` and replace the empty values with your Supabase project URL and **publishable/anon browser key**.

Example:

```js
window.GRE_CONFIG = {
  supabaseUrl: "https://YOUR-PROJECT.supabase.co",
  supabaseKey: "YOUR-PUBLISHABLE-OR-ANON-KEY"
};
```

Do **not** put a `service_role` or secret key in the frontend.

The browser key is intended to be exposed to the frontend; security comes from Supabase Row Level Security policies. Keep RLS enabled.

## 4. Publish on GitHub Pages

Put the contents of this folder into your GitHub repository.

The easiest route is to use the repository's `main` branch as the publishing source. In **Settings → Pages**, choose the branch/folder containing these files. GitHub Pages can publish plain static HTML/CSS/JavaScript files directly.

After publishing, open the generated `github.io` URL.

## Notes

- A word is `new` when it has no row in `word_progress`.
- `review` and `confident` are stored explicitly.
- Moving a word between piles updates one database row.
- The supplied dictionary definitions are preserved in `words.json`. The contextual hints are original examples created for this app.
