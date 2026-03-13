# How to Manage Website Content

This website is designed to be easily updated by editing the `content.json` file. 

## 1. Basic Structure
The `content.json` file contains all the text, links, and media paths for your portfolio.
- `ui`: Navigation labels, button text, and section headers.
- `basics`: Your name, bio, contact info, social links, and **Scholar ID**.
  - `scholarId`: Your Google Scholar ID (e.g., `"tnF56TUAAAAJ"`). Found in your Scholar profile URL: `https://scholar.google.com/citations?user=YOUR_ID`
  - Used by `update_scholar.py` to auto-sync citations and publications.
- `education`: Your degrees.
- `research`: Overview, themes, projects, demos, and internships.
- `publications`: List of papers, datasets, and patents.
- `teaching`: Courses taught and **Talks & Events** (seminars, presentations).
- `certificates`: Additional certifications.
- `workshops`: Workshops and training programs attended.

> **Note:** JSON does not support comments (`//` or `/* */`). Use this Readme as your reference for the file structure.

## 2. Adding Links inside Text
You can now use Markdown-style syntax to add links, bold, or italics within any text field:

- **Hyperlink**: `[Link Text](https://example.com)`
  Example: `Researching [3D SLAM](https://en.wikipedia.org/wiki/Simultaneous_localization_and_mapping) for drones.`
- **Bold**: `**Text**`
  Example: `**PhD Candidate** at KFUPM.`
- **Italics**: `*Text*`
  Example: `Focusing on *perception* and *robotics*.`

## 3. Adding New Items
Simply add a new object to the corresponding array in `content.json`.

### Example: Adding a Project
```json
{
  "title": "New Research Project",
  "details": "Summary of the project with a [link](https://example.com).",
  "linkText": "View Paper",
  "linkUrl": "https://doi.org/...",
  "category": "3D SLAM"
}
```

### Example: Adding a Research Demo
1. Upload your image or video to the `demos/images/` or `demos/videos/` folder.
2. Add the entry in `content.json`:
```json
{
  "title": "Interactive Demo",
  "description": "Short description of the demo.",
  "media": [
    "demos/images/your_image.jpg",
    "demos/videos/your_video.mp4"
  ]
}
```

## 4. Syncing to GitHub
Once you have saved your changes locally, run the sync script to push them live:
- **Windows**: Right-click `sync.ps1` and select "Run with PowerShell".
- **Mac/Linux**: Open terminal and run `./sync.sh`.

The website will update automatically within a few minutes.
