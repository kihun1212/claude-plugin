# second-brain

Search your personal markdown wiki/notes through [QMD](https://github.com/tobi/qmd), scoped to a single collection. <br>
Installing this plugin lets you drop the "always search my wiki" instruction from `CLAUDE.md` — the skills auto-trigger on knowledge questions, and the agent runs the search in an isolated context so only the answer comes back.

## What it does

| Component | Purpose |
| --- | --- |
| `wiki-searcher` (agent) | Queries QMD scoped to your wiki collection, returns a cited answer. Token-isolated. |
| `/wiki-search` (skill) | Find notes/pages about a term. |
| `/wiki-ask` (skill) | Get a synthesized, cited answer drawn from your notes. |

No bundled LLM or search engine — retrieval is delegated entirely to QMD (BM25 + vector + HyDE).

## Requirements

- The **QMD plugin** installed and running.
- A QMD collection containing your wiki, indexed and embedded:
  - `qmd status` — verify the collection exists.
  - `qmd embed` — build vectors if pending.

## Configuration

### Where the wiki path lives

This plugin **does not store a filesystem path**. It only references a QMD *collection name*.
The actual `collection name → directory` mapping is owned by QMD, in `~/.config/qmd/index.yml`:

```yaml
collections:
  wiki:
    path: /Users/you/path/to/your/wiki   # ← your wiki lives here
    pattern: "**/*.md"
```

So to point this plugin at a wiki:
1. Add (or confirm) a collection in `~/.config/qmd/index.yml` pointing at your wiki directory.
2. Index it: `qmd embed` (and check with `qmd status`).
3. Make sure the collection name matches the one set below.

### Collection name

The only plugin-side setting is the **collection name**, defaulting to `wiki`. To use a
different name, edit the one marked line in `agents/wiki-searcher.md`:

```
- **QMD collection:** `wiki`  ← change this
```

## Usage

```
/wiki-search authentication flow
/wiki-ask how did I decide to structure the wiki index?
```

Or just ask naturally about your own notes — the agent triggers automatically.
