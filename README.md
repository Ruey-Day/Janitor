# TRINKET LAB

A small console of browser-only trinkets, hosted on GitHub Pages.
No build step, no server, no uploads — everything happens in your tab.

**Live:** https://rueyday.github.io/WebLab/

## 01 · Text Metrics
Paste or type into the buffer and get live counts:

- characters (including whitespace)
- characters (without whitespace)
- words
- lines

Plus paste / copy / clear on the buffer.

## 02 · Image Forge
Load an image by **pasting it anywhere** (⌘V / Ctrl+V), dropping a file on the
page, or browsing your disk. Then:

- **Invert** — flip the RGB channels
- **Crop** — drag a region on the image, then *Crop selection* (Esc clears it)
- **Reset** — back to the original
- **Download PNG** — save the edited result

Operations stack, so you can crop, invert, crop again, then download.

## Files
| file | what it is |
| --- | --- |
| `index.html` | markup for both tabs |
| `styles.css` | the whole visual system |
| `app.js` | text metrics + canvas image editor |

## Deploying
GitHub Pages serves this straight from the default branch root — no workflow
needed. In **Settings → Pages**, set *Source: Deploy from a branch*,
*Branch: `main` / `/ (root)`*. Every push to `main` republishes.

Locally: `python3 -m http.server 8777` then open http://localhost:8777.

## Links


**Stuff**
- https://docs.google.com/document/d/1uxSBcbUm9D7VS126Q2Donh8F1LV-in3Jo30mMCgRyck/edit?tab=t.0

**VM**
- https://drive.google.com/drive/folders/1wMiWXJXqGRYzEg5KB68p-NVnI0UbFf7u?usp=sharing

**Dropbox**
- https://www.dropbox.com/scl/fo/h49i0ajs1se7he0dxbgst/AAFxS9V1RMV_EX6QQ_GMWGs?rlkey=0qvm30nw6fnejquqtxjqoovgp&st=rcf2aetf&dl=0
