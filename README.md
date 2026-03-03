# Yasser El-Alfy — Website

This repository is a Jekyll-powered personal website for **Yasser El‑Alfy**. It uses the simple structure below:

```
/_config.yml
/index.md
/about.md
/projects.md
/contact.md
/_layouts/default.html
/assets/css/style.css
/assets/resume.pdf  # upload your PDF here
```

## How to publish on GitHub Pages
1. Create a new public repository named `yasser-el-alfy.github.io`.
2. Add these files and commit.
3. Push to the `main` branch.
4. In the repository settings → Pages, ensure the site is served from the `main` branch (/).

Git commands example:
```bash
git init
git add .
git commit -m "Initial Jekyll site"
git branch -M main
git remote add origin https://github.com/your-username/yasser-el-alfy.github.io.git
git push -u origin main
```

## Adding your resume
Replace `assets/resume.pdf` with your PDF file. It will then be downloadable from the home page.

## Customization
- Edit the Markdown files (`index.md`, `about.md`, `projects.md`, `contact.md`) to change copy.
- Replace links to GitHub, LinkedIn, Twitter in the layout or pages.

---
