---
custom-width: 62
---

# PR 11 Test

Diese Notiz hat im Frontmatter `custom-width: 60`. Wir simulieren zwei Nutzer:

- User A hat 60 gesetzt und in den Vault committet.
- User B (wir) will die Breite temporaer verstellen, ohne A's Datei anzufassen.

Fuer den Test:
1. autoSaveYaml AUS in den Plugin-Settings
2. Slider auf 30 ziehen
3. Datei pruefen: `custom-width: 60` unveraendert
4. Tab wechseln und zurueck: Ansicht liegt wieder bei 60 (das ist gewollt, wir schuetzen A)
5. autoSaveYaml AN, Slider auf 80: Datei jetzt `custom-width: 80`
