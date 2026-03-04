# Obsidian Custom Note Width

A plugin for Obsidian that enables you to easily adjust the editor's line width on a note-by-note basis.
All these following options ensure that users have a tailored experience, making line width adjustments both efficient and user-friendly.
To make this task more intuitive and adaptable to your preferences, the plugin offers several methods:

- Employ a straightforward slider or textbox situated in the status bar for quick and visual adjustments.
- For users who prefer to work with YAML front matter there is an option to set a custom width through YAML, allowing you to maintain specific formatting or structures in your notes.
- Integrated commands have been added, which can be executed directly within the Obsidian interface. This is especially handy for users who prefer quick actions or are accustomed to using keyboard shortcuts, offering a seamless way to modify the line width without diving into settings or codes.

![Demo GIF](/images/demo.gif)

## Features

- Customize line width for individual notes (or all notes) using a convenient slider in the status bar.
- Support for multiple width units: **%** (percentage), **px** (pixels), and **ch** (character widths).
- Easily increase or decrease line width to tailor your editing experience.
- User-friendly interface for intuitive usage.
- Fully customizable through settings for personalized adjustments.

## Usage

Once you enable the plugin in the settings menu, a slider will appear in the bottom right status bar.
With this plugin, you can easily make real-time adjustments to the width of notes using either the slider or the textfield, ensuring a smooth and seamless editing experience.

### Width Units

The plugin supports three width units:

- **%** (Percentage): Width relative to the editor pane (0-100%).
- **px** (Pixels): Absolute width in pixels (100-4000px).
- **ch** (Characters): Width based on character count (10-200ch).

You can switch between units by clicking the unit label next to the value in the status bar. The slider range adjusts automatically to match the selected unit.

## Settings

### General Settings

- **Default width unit**: Choose the default unit (%, px, or ch) for the note width.
- **Default width**: Set the default width value for notes without a per-note width.
- **Per-note width**: Enable or disable individual widths per note via YAML frontmatter.
- **YAML front matter key**: Customize the key used in YAML frontmatter (default: `custom-width`).

### Style Settings

- Enable or disable the slider
- Enable or disable the textbox
- Adjust the slider width

## Installation

The plugin can be found in the Community Plugins directory which can be accessed from the Settings pane under Third Party Plugins.

## Manual installation

1. Download custom-note-width.zip located at [latest release](https://github.com/0skater0/obsidian-custom-note-width/releases)
2. Extract the obsidian-custom-note-width folder from the zip to your vault's plugins <br> folder: `<vault>/.obsidian/plugins/`  Note: On some machines the `.obsidian` folder may be hidden. On MacOS you should be able to press `Command+Shift+Dot` to show the folder in Finder.
3. Reload Obsidian
4. If prompted about Safe Mode, you can disable safe mode and enable the plugin.

## Important

> **IT'S IMPORTANT TO REGULARLY MAKE BACKUPS! DON'T FORGET TO PROTECT YOUR DATA!**

## Theme Compatibility

> **Disclaimer:** This plugin modifies the CSS variable `--file-line-width` to control the editor's line width.
> Custom themes may override or interfere with this variable, which can cause the plugin to malfunction.
> **There is no guarantee that this plugin works with every custom theme.**
>
> The plugin requires **"Readable line length"** to be enabled in Obsidian's Editor settings (`Settings > Editor > Readable line length`).

### Tested Themes

| Theme | Status | Obsidian Version | Notes |
|-------|--------|-----------------|-------|
| Default | Works | 1.12.4 | Fully functional |
| Things | Works | 1.12.4 | Fully functional |

**Your theme is not listed?** If you have tested the plugin with a theme not listed above, please submit a Pull Request to add it to the table. This helps other users know which themes are compatible.

To contribute:
1. Fork this repository
2. Edit the table in `README.md` and add your theme with its status
3. Submit a Pull Request with the title: `Theme compatibility: [Theme Name]`

## Reporting Bugs

If you encounter an issue, please create a new [issue](https://github.com/0skater0/obsidian-custom-note-width/issues) on GitHub. To help me investigate and resolve the problem, **please include the following information:**

### Required Information

1. **Obsidian version** (found in `Settings > General`, top of the page)
2. **Plugin version** (found in `Settings > Community plugins`, listed next to "Custom Note Width")
3. **Theme name** you are using (found in `Settings > Appearance > Themes`)
4. **Operating system** (Windows / macOS / Linux)

### How to Check for Errors

1. Open the **Developer Console** in Obsidian:
   - **Windows/Linux:** `Ctrl + Shift + I`
   - **macOS:** `Cmd + Option + I`
2. Click the **Console** tab
3. Look for any **red error messages** that mention `custom-note-width`
4. Copy and paste any relevant errors into your issue report

### Describe the Problem

- **What did you expect to happen?**
- **What actually happened?**
- **Step-by-step reproduction:** Describe exactly what you did, step by step, so the issue can be reproduced.
- **How often does it occur?** (Always / Sometimes / Only once)
- **Are you using "Readable line length"?** (`Settings > Editor > Readable line length`)

### Screenshots and Videos

- **Screenshots** help me see what you see. Please include them whenever possible.
- **Short screen recordings** (e.g., via [LICEcap](https://www.cockos.com/licecap/), [ShareX](https://getsharex.com/), or the built-in screen recorder on your OS) are even better, especially for visual glitches or issues that involve interactions (switching tabs, dragging sliders, etc.).

> **Reports that only say "it doesn't work" without any details cannot be investigated.** The more information you provide, the faster I can help.

## License

This plugin is licensed under the MIT License. See the [LICENSE](LICENSE) file for more information.
Please note that this plugin is provided as-is without any warranty. Use it at your own risk.

### Support Me & my work

This plugin is offered completely free of charge!

If you fancy buying me a coffee to fuel more creations like this plugin, you have the option to do so by clicking the button below.

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/P5P7NLC40)
