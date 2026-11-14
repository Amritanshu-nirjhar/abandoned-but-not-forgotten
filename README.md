# Abandoned but Not Forgotten

Storytelling about NASA's discarded equipment on the Moon and Mars. A NASA Space Apps project.

Three pages, all static files with no build step:

- **`index.html` — the listening station.** Tune a dial across 30 objects left on two worlds. You wait out the real light delay, most signals come back silent, and one (the Apollo retroreflectors) still answers. Ends with the total weight left behind and the question of whether it is junk or heritage.
- **`film.html` — an 80-second narrated film** in 3D: launch, the rocket stage hitting the Moon, the gifts astronauts left, liftoff, Mars, the dust storm, and the laser that still comes back.
- **`models.html` — the hardware bay.** Walk a timeline of ten machines, step up to one, take it apart, and learn what each part did. Includes a find-the-part game and a size comparison.

## Run it

Open `index.html` in a browser, or serve the folder:

```
python3 -m http.server 8000
```

An internet connection is needed: NASA's 3D models, the planet maps and the photographs load at runtime.

## Files

| File | What it holds |
|---|---|
| `data.js` | Every object: title, coordinates, mass, dates, narrative, status, image. Add an entry and the station picks it up. |
| `models.js` | The 3D machines, their parts and descriptions, and the loader for NASA's models. |
| `app.js`, `style.css` | The listening station. |
| `narration/make.sh` | Renders the film's narration to audio clips with a voice installed on a Mac. Without clips the film uses the browser's speech voice. |

## Sources

- Hotham, T., *Junk on the Moon and Mars: An Inventory of Every Human-Made Object on Two Worlds*, Zenodo [23872995](https://zenodo.org/records/23872995), [24136681](https://zenodo.org/records/24136681)
- [NASA Image and Video Library](https://images.nasa.gov/) (public domain)
- [NASA 3D Resources](https://github.com/nasa/NASA-3D-Resources)
- Planet maps: [Solar System Scope](https://www.solarsystemscope.com/textures/), CC BY 4.0

## Known gaps

- Narratives and part descriptions were written from general knowledge and have not all been checked against NASA pages.
- The two news-coverage links in `data.js` are placeholders.
- The Opportunity rover, Mars Polar Lander, retroreflector and Saturn V third stage are simplified hand-built models; NASA publishes no usable model of them.
