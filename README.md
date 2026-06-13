# The Codex of the Fog

A fan-made Dead by Daylight reference site — DBD patch 9.5.0.

## How to open

Double-click `index.html`. No server needed.

## Contents

- **169 survivor perks** — searchable, filterable by tier / category / character
- **22 killers** — ranked S–D with powers, strengths, weaknesses, DLC info
- **52 survivors** — ranked with model size, noise level, and notable perks
- **15 combo builds** — curated loadouts with strategy explanations
- **About** — tier legend and disclaimer

## How to regenerate data

Requires Python 3 + openpyxl (`pip install openpyxl`).

```
python scripts/build_data.py
```

Source files needed in the root folder:
- `dbd_perks_updated_F - Copy.xlsx`
- `dbd_perks_updated_F.txt`

## Disclaimer

Fan project. Not affiliated with Behaviour Interactive Inc.  
Dead by Daylight © Behaviour Interactive.  
Data sourced from community research, patch 9.5.0.
