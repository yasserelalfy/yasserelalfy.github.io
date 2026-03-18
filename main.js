let globalData = null;
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
  const loadingText = document.getElementById('loading-text');
  document.getElementById('year').textContent = new Date().getFullYear();

  try {
    const res = await fetch('content.json?v=' + Date.now());
    if (!res.ok) throw new Error('Failed to load content');
    const rawData = await res.json();
    globalData = applyMarkdown(rawData);

    // Apply Dynamic Sorting Logic
    globalData = sortContent(globalData);

    if (loadingText) loadingText.textContent = globalData.ui.loading;

    initThreeJS();
    initTheme();
    renderContent(globalData);
    setupNavigation();
    setupDemoModal();
    initScrollReveal();

  } catch (err) {
    console.error(err);
    document.getElementById('content-mount').innerHTML = `<div class="container" style="padding: 200px 0; text-align: center;"><h2>${globalData?.ui?.errors?.loadFailed || 'System failure.'}</h2><p class="muted">${globalData?.ui?.errors?.loadFailedDetail || 'Check content.json integrity.'}</p></div>`;
  }
});

/* --- PREMIUM THREE.JS BACKGROUND --- */
function initThreeJS() {
  const container = document.getElementById('three-bg');
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  // Floating Geometry Nodes
  const group = new THREE.Group();
  scene.add(group);

  const geometry = new THREE.IcosahedronGeometry(1.5, 1);
  const material = new THREE.MeshPhongMaterial({
    color: 0x00d4ff,
    wireframe: true,
    transparent: true,
    opacity: 0.1
  });

  for (let i = 0; i < 30; i++) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20);
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    mesh.scale.setScalar(Math.random() * 0.5 + 0.1);
    group.add(mesh);
  }

  const pointLight = new THREE.PointLight(0x00d4ff, 1);
  pointLight.position.set(5, 5, 5);
  scene.add(pointLight);
  scene.add(new THREE.AmbientLight(0xffffff, 0.2));

  camera.position.z = 10;

  let mouseX = 0, mouseY = 0;
  document.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  const animate = () => {
    requestAnimationFrame(animate);
    group.rotation.y += 0.001;
    group.rotation.x += 0.0005;

    group.position.x += (mouseX * 2 - group.position.x) * 0.02;
    group.position.y += (-mouseY * 2 - group.position.y) * 0.02;

    renderer.render(scene, camera);
  };
  animate();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function initTheme() {
  const toggle = document.getElementById('theme-toggle');
  const html = document.documentElement;
  const savedTheme = localStorage.getItem('theme') || 'dark';
  html.setAttribute('data-theme', savedTheme);
  toggle.textContent = savedTheme === 'dark' ? '🌙' : '☀️';

  toggle.addEventListener('click', () => {
    const cur = html.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    toggle.textContent = next === 'dark' ? '🌙' : '☀️';
  });
}

function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('revealed'); });
  }, { threshold: 0.1 });
  document.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el));
}

function linkifyTabs(text) {
  const tabs = ['home', 'research', 'publications', 'teaching', 'connect'];
  let up = text;
  tabs.forEach(t => {
    const regex = new RegExp(`(${t})\\s+tab`, 'gi');
    up = up.replace(regex, (m, p1) => `<a href="#${p1.toLowerCase()}" class="link-ext">${p1} tab</a>`);
  });
  return up;
}

function parseMarkdown(text) {
  if (typeof text !== 'string' || !text) return text || '';
  let html = text
    // Links: [text](url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="link-ext" style="text-decoration: underline;">$1</a>')
    // Bold: **text**
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Italics: *text*
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return html;
}

function applyMarkdown(obj, path = '') {
  if (typeof obj === 'string') {
    const p = path.toLowerCase();
    // Do not parse URLs, IDs, Media, or Meta Tags
    if (p.includes('.meta') || p.endsWith('url') || p.endsWith('media') || p.endsWith('id') || p.includes('metrics')) {
      return obj;
    }
    return parseMarkdown(obj);
  } else if (Array.isArray(obj)) {
    return obj.map((item, idx) => applyMarkdown(item, `${path}[${idx}]`));
  } else if (obj !== null && typeof obj === 'object') {
    const res = {};
    for (const key in obj) {
      const nextPath = path ? `${path}.${key}` : key;
      res[key] = applyMarkdown(obj[key], nextPath);
    }
    return res;
  }
  return obj;
}

/**
 * Extracts the most recent year from a string like "2023-present" or "2018-2020"
 */
function getLatestYear(periodStr) {
  if (!periodStr) return 0;
  const s = periodStr.toString().toLowerCase();
  if (s.includes('present') || s.includes('now')) return new Date().getFullYear() + 1; // Future weight
  const years = s.match(/\d{4}/g);
  if (years) return Math.max(...years.map(Number));
  return 0;
}

/**
 * Automatically reorders content based on user priorities
 */
function sortContent(data) {
  // 1. Sort Research Demos (Videos > Scripts > Images)
  if (data.research && data.research.interactiveDemosList) {
    data.research.interactiveDemosList.sort((a, b) => {
      const getWeight = (item) => {
        const hasVideo = (item.media || []).some(m => m.toLowerCase().endsWith('.mp4'));
        if (hasVideo) return 1;                               // Has any video
        if (item.pyScript || item.colabUrl) return 2;         // Script/Colab
        return 3;                                             // Images only
      };
      return getWeight(a) - getWeight(b);
    });
  }

  // 2. Sort Dated Content (Most Recent First)
  const sortByDate = (arr, key = 'period') => {
    if (!arr) return;
    arr.sort((a, b) => {
      const yearA = getLatestYear(a[key] || a.year || a.date);
      const yearB = getLatestYear(b[key] || b.year || b.date);
      return yearB - yearA;
    });
  };

  sortByDate(data.education.degrees);
  sortByDate(data.education.workExperience);
  sortByDate(data.education.workshops);
  sortByDate(data.publications.articles);
  sortByDate(data.publications.datasets);
  sortByDate(data.teaching.courses);
  sortByDate(data.teaching.talks, 'date');

  return data;
}

function renderContent(data) {
  const mount = document.getElementById('content-mount');

  document.getElementById('page-title').textContent = data.ui.meta.title;
  const metaDesc = document.getElementById('meta-description');
  if (metaDesc) metaDesc.setAttribute('content', data.ui.meta.description);

  document.getElementById('nav-name').innerHTML = data.basics.name;
  document.getElementById('nav-avatar').innerHTML = data.basics.navbarInitials;
  document.getElementById('footer-name').innerHTML = data.basics.name;
  document.getElementById('footer-affiliation').innerHTML = data.basics.affiliation;

  // Populate nav labels from content.json
  const navMap = data.ui.sections;
  const navIds = {
    'nav-home': navMap.home, 'researchBtn': navMap.research,
    'nav-researchOverview': navMap.overview, 'nav-researchThemes': navMap.themes,
    'nav-researchProjects': navMap.projects, 'nav-researchDemos': navMap.demos,
    'nav-publications': navMap.publicationsNav, 'teachingBtn': navMap.teaching,
    'nav-teachingCourses': navMap.courses, 'nav-teachingTalks': navMap.talksEvents,
    'educationBtn': navMap.education,
    'nav-educationDegrees': navMap.degrees, 'nav-educationCertificates': navMap.certificates,
    'nav-educationWorkshops': navMap.workshops,
    'nav-workExperience': navMap.workExperience,
    'nav-connect': navMap.connectBtn
  };
  Object.entries(navIds).forEach(([id, text]) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = text;
  });

  // Populate footer version
  const footerVer = document.getElementById('footer-version');
  if (footerVer) footerVer.innerHTML = data.ui.footer.version;

  const linkifiedPubSummary = linkifyTabs(data.publications.summary);

  const totalPubs = (data.publications.articles?.length || 0) +
    (data.publications.datasets?.length || 0) +
    (data.publications.patents?.length || 0);

  mount.innerHTML = `
    <!-- HOME -->
    <section id="home" class="section tabSection active" data-tab="home">
      <div class="container">
        <div class="heroGrid">
          <div data-reveal>
            <div class="pill">${data.ui.hero.welcomeBadge}</div>
            <h1>${data.ui.hero.headlinePre}<span style="color:var(--accent)">${data.ui.hero.headlineAccent}</span>${data.ui.hero.headlinePost}</h1>
            <p class="lead">${parseMarkdown(data.basics.heroSubtitle)}</p>
            <div class="stack" style="flex-direction:row; gap:16px; margin-bottom:40px; flex-wrap:wrap;">
              <!-- <a class="btn" href="${data.basics.cvUrl}" target="_blank">${data.ui.hero.ctaPrimary}</a> -->
              <a class="btn" href="${data.basics.cvUrlGenerated}" target="CV.pdf">${data.ui.hero.ctaGenerate}</a>
              <a class="btn secondary" href="#publications">${data.ui.hero.ctaSecondary}</a>
              <a class="btn secondary" href="#research-demos">${data.ui.hero.ctaSamples}</a>
            </div>
            <div style="margin-top:24px;">
              ${data.basics.heroSkillTags.map(p => `<span class="pill">${p}</span>`).join('')}
            </div>
          </div>
          <div class="card" style="padding:0; overflow:hidden;" data-reveal>
            <img class="photo" src="${data.basics.photoUrl}" alt="${data.basics.name}" style="width:100%; height:400px; object-fit:cover;" />
            <div style="padding:32px;">
              <h3 style="margin-bottom:12px;">${data.basics.name}</h3>
              <p class="muted" style="font-size:14px;">${data.ui.hero.photoCaption.replace('{totalPubs}', totalPubs)}</p>
            </div>
          </div>
        </div>
        
        <!-- Quick Facts -->
        <div data-reveal style="margin-top:60px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:32px; flex-wrap:wrap; gap:16px;">
            <h2 style="margin-bottom:0;">${data.ui.quickFacts.title}</h2>
          </div>
          <div class="card card-stats" style="display:grid; grid-template-columns: repeat(4, 1fr); gap:40px; text-align:center;">
             <div><div style="font-size:32px; font-weight:700; color:var(--accent);">${data.basics.quickFactsMetrics.citations}</div><div class="muted" style="font-size:11px;">${data.ui.quickFacts.labels.citations}</div></div>
             <div><div style="font-size:32px; font-weight:700; color:var(--accent);">${data.basics.quickFactsMetrics.hIndex}</div><div class="muted" style="font-size:11px;">${data.ui.quickFacts.labels.hIndex}</div></div>
             <div><div style="font-size:32px; font-weight:700; color:var(--accent);">${data.basics.quickFactsMetrics.hIndex5y}</div><div class="muted" style="font-size:11px;">${data.ui.quickFacts.labels.hIndex5y}</div></div>
             <div><div style="font-size:32px; font-weight:700; color:var(--accent);">${totalPubs}</div><div class="muted" style="font-size:11px;">${data.ui.quickFacts.labels.publications}</div></div>
             
             <div><div style="font-size:32px; font-weight:700; color:var(--accent);">${data.basics.quickFactsMetrics.i10Index}</div><div class="muted" style="font-size:11px;">${data.ui.quickFacts.labels.i10Index}</div></div>
             <div><div style="font-size:32px; font-weight:700; color:var(--accent);">${data.basics.quickFactsMetrics.i10Index5y}</div><div class="muted" style="font-size:11px;">${data.ui.quickFacts.labels.i10Index5y}</div></div>
             <div><div style="font-size:32px; font-weight:700; color:var(--accent); display: flex; align-items: center; justify-content: center; height: 38px;">${data.ui.quickFacts.labels.roleDegree}</div><div class="muted" style="font-size:11px;">${data.ui.quickFacts.labels.roleStatus}</div></div>
             <div><div style="font-size:32px; font-weight:700; color:var(--accent); display: flex; align-items: center; justify-content: center; height: 38px;">${data.basics.affiliation}</div><div class="muted" style="font-size:11px;">${data.ui.quickFacts.labels.universityName}</div></div>
          </div>
        </div>
      </div>
    </section>

    <!-- EDUCATION - DEGREES -->
    <section id="education-degrees" class="section tabSection" data-tab="education">
      <div class="container">
        <div class="card" data-reveal>
          <h2>${data.ui.sections.education}</h2>
          <div class="stack" style="margin-top:24px;">
            ${data.education.degrees.map(e => `
              <div class="item" style="border-left:2px solid var(--accent); padding-left:24px;">
                <div style="font-weight:600; font-size:16px;">${e.degree}</div>
                <div class="muted" style="font-size:13px;">${e.institution} | ${e.period}</div>
                ${e.details ? `<div style="font-size:12px; margin-top:4px;">${e.details}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </section>

    <!-- RESEARCH OVERVIEW -->
    <section id="research-overview" class="section tabSection" data-tab="research">
      <div class="container">
        <div class="card" data-reveal>
          <h2>${data.ui.sections.researchStrategy}</h2>
          ${data.basics.shortBio ? `<p class="muted" style="margin-top:16px; font-size:16px;">${parseMarkdown(data.basics.shortBio)}</p>` : ''}
          <p class="lead" style="margin-top:20px; max-width:100%;">${parseMarkdown(data.research.strategyOverview.text)}</p>
          <div class="grid2" style="margin-top:40px;">
             <div class="card" style="background:var(--bg2); padding:30px; border: 1px solid var(--accent-dim);">
               <h3 style="margin-bottom:20px; font-size: 18px; color:var(--accent);">${data.ui.sections.researchAreas}</h3>
               <ul style="list-style:none; display:grid; grid-template-columns: 1fr; gap:16px;">
                 ${data.research.strategyOverview.researchAreas.map(s => `<li style="font-size:15px; display:flex; align-items:center; gap:8px;"><span style="color:var(--accent);">▹</span> ${s}</li>`).join('')}
               </ul>
             </div>
             <div class="card" style="background:var(--bg2); padding:30px; border: 1px solid var(--border);">
               <h3 style="margin-bottom:15px; font-size:16px;">${data.ui.sections.technicalSkills}</h3>
               <div>
                 <h4 style="font-size:12px; color:var(--accent); margin-bottom:6px;">${data.ui.sections.languagesFrameworks}</h4>
                 <div style="display:flex; flex-wrap:wrap; gap:6px;">
                   ${data.research.technicalSkills.languages.map(s => `<span class="pill" style="font-size:10px;">${s}</span>`).join('')}
                 </div>
               </div>
                               <div style="margin-top:12px;">
                  <h4 style="font-size:12px; color:var(--accent); margin-bottom:6px;">${data.ui.sections.softwareTools}</h4>
                  <div style="display:flex; flex-wrap:wrap; gap:6px;">
                    ${data.research.technicalSkills.software.map(s => `<span class="pill" style="font-size:10px; opacity:0.8;">${s}</span>`).join('')}
                  </div>
                </div>
                <div style="margin-top:12px;">
                  <h4 style="font-size:12px; color:var(--accent); margin-bottom:6px;">${data.ui.sections.operatingSystems}</h4>
                  <div style="display:flex; flex-wrap:wrap; gap:6px;">
                    ${data.research.technicalSkills.os.map(s => `<span class="pill" style="font-size:10px; opacity:0.8;">${s}</span>`).join('')}
                  </div>
                </div>
                <div style="margin-top:12px;">
                  <h4 style="font-size:12px; color:var(--accent); margin-bottom:6px;">${data.ui.sections.otherSkills}</h4>
                  <div style="display:flex; flex-wrap:wrap; gap:6px;">
                    ${data.research.technicalSkills.otherSkills.map(s => `<span class="pill" style="font-size:10px; opacity:0.8;">${s}</span>`).join('')}
                  </div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </section>

    <!-- RESEARCH THEMES -->
    <section id="research-themes" class="section tabSection" data-tab="research">
      <div class="container">
        <div class="stack">
          <h2 data-reveal>${data.ui.sections.researchThemes}</h2>
          <div class="grid2">
            ${data.research.researchThemesList.map(t => `
              <div class="card item" data-reveal>
                <h3>${t.title}</h3>
                <p class="muted" style="margin-top:10px;">${parseMarkdown(t.description)}</p>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </section>

    <!-- RESEARCH PROJECTS -->
    <section id="research-projects" class="section tabSection" data-tab="research">
      <div class="container">
        <div class="card" data-reveal>
          <h2>${data.ui.sections.activeProjects}</h2>
          <div class="filter-bar" id="project-filter-bar" style="margin-top:24px;">
            <!-- Categories injected by renderContent -->
          </div>
          <div id="project-list" class="stack"></div>
        </div>
      </div>
    </section>

    <!-- RESEARCH DEMOS -->
    <section id="research-demos" class="section tabSection" data-tab="research">
      <div class="container">
        <div class="card" data-reveal>
          <h2>${data.ui.sections.spatialPerceptionDemo}</h2>
          <p class="muted" style="margin-bottom:32px;">${data.ui.sections.demoDescription}</p>
          <div id="demos-gallery" class="grid2">
            ${(data.research.interactiveDemosList || []).map((demo, i) => {
    const mediaList = demo.media || [];
    const hasVideo = mediaList.some(m => m.toLowerCase().endsWith('.mp4'));
    const hasImage = mediaList.some(m => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(m));
    const isScript = !!demo.pyScript || !!demo.colabUrl;

    // Build array of all applicable badges
    const badges = [];
    if (hasVideo) badges.push({ icon: '🎬', label: data.ui.sections.videoBadge || 'Video' });
    if (isScript) badges.push({ icon: '🐍', label: data.ui.sections.pythonBadge || 'Python' });
    if (hasImage) badges.push({ icon: '🖼️', label: data.ui.sections.imageBadge || 'Image' });
    if (badges.length === 0) badges.push({ icon: '📁', label: 'Demo' });

    // Pick the primary icon for the fallback placeholder
    const icon = badges[0].icon;

    return `
              <div class="card item" style="background:var(--bg2); cursor:pointer;" data-demo-index="${i}">
                <div style="width:100%; height:200px; border-radius:12px; background:var(--bg); display:flex; align-items:center; justify-content:center; overflow:hidden; border:1px solid var(--border); position: relative;">
                  ${demo.media && demo.media.length > 0
        ? (demo.media[0].toLowerCase().endsWith('.mp4'))
          ? `<video src="${demo.media[0]}" style="width:100%; height:100%; object-fit:cover;" autoplay loop muted playsinline onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"></video><div style="display:none; align-items:center; justify-content:center; width:100%; height:100%;"><span style='font-size:48px;'>${icon}</span></div>`
          : `<img src="${demo.media[0]}" alt="${demo.title}" style="width:100%; height:100%; object-fit:cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" /><div style="display:none; align-items:center; justify-content:center; width:100%; height:100%;"><span style='font-size:48px;'>${icon}</span></div>`
        : `<span style='font-size:48px;'>${icon}</span>`
      }
                  ${demo.media && demo.media.length > 1 ? `<div style="position:absolute; bottom:8px; right:8px; background:rgba(0,0,0,0.7); color:#fff; border-radius:12px; font-size:10px; padding:2px 8px; font-weight:bold;">1/${demo.media.length}</div>` : ''}
                </div>
                <h3 style="margin-top:12px; font-size:15px;">${demo.title}</h3>
                <p class="muted" style="font-size:12px; margin-top:4px;">${parseMarkdown(demo.description)}</p>
                <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:8px;">
                  ${badges.map(b => `<span class="pill" style="font-size:10px;">${b.icon} ${b.label}</span>`).join('')}
                </div>
              </div>
            `}).join('')}
          </div>
        </div>
      </div>
    </section>

    <!-- WORK EXPERIENCE -->
    <section id="work-experience" class="section tabSection" data-tab="education">
      <div class="container">
        <div class="card" data-reveal>
          <h2>${data.ui.sections.workExperience}</h2>
          <div class="stack" style="margin-top:24px;">
            ${data.education.workExperience.map(i => `
              <div class="item" style="border-left:2px solid var(--accent); padding-left:24px;">
                <div style="font-weight:600; font-size:16px;">${i.title}</div>
                <div class="muted" style="font-size:13px;">${i.institution} | ${i.period}</div>
                ${i.type ? `<span class="pill" style="margin-top:8px;">${i.type}</span>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </section>

    <!-- PUBLICATIONS -->
    <section id="publications" class="section tabSection" data-tab="publications">
      <div class="container">
        <div class="card" data-reveal>
          <h2>${data.ui.sections.scientificContributions}</h2>
          <p class="muted" style="margin:16px 0 32px;">${data.ui.sections.pubSummaryTemplate.replace('{totalPubs}', totalPubs)}</p>
          
          <div class="filter-bar">
            <button class="filter-btn active" data-filter="all">${data.ui.filters.all}</button>
            <button class="filter-btn" data-filter="article">${data.ui.filters.articles}</button>
            <button class="filter-btn" data-filter="dataset">${data.ui.filters.datasets}</button>
            <button class="filter-btn" data-filter="patent">${data.ui.filters.patents}</button>
          </div>

          <div id="subfilter-bar" class="filter-bar" style="margin-top:-20px; font-size:0.9em; opacity:0.8;">
            <!-- Categories injected by initFilterLogic -->
          </div>

          <div id="pub-list" class="stack"></div>
        </div>
      </div>
    </section>

    <!-- TEACHING -->
    <section id="teaching-courses" class="section tabSection" data-tab="teaching">
      <div class="container">
        <div class="card" data-reveal>
          <h2>${data.ui.sections.teachingProfile}</h2>
          <div class="grid2" style="margin-top:32px;">
            ${data.teaching.courses.map(c => `
              <div class="card item" style="background:var(--bg2); padding: 24px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span class="pill" style="margin:0;">${c.id}</span>
                  ${c.period ? `<span class="muted" style="font-size:12px;">${c.period}</span>` : ''}
                </div>
                <div style="font-weight:600; font-size: 16px; margin-top:12px;">${c.title}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </section>

    <!-- TEACHING - TALKS & EVENTS -->
    <section id="teaching-talks" class="section tabSection" data-tab="teaching">
      <div class="container">
        <div class="card" data-reveal>
          <h2>${data.ui.sections.talksEvents}</h2>
          <div class="stack" style="margin-top:32px;">
            ${(data.teaching.talks || []).map(talk => `
              <div class="item card" style="background:var(--bg2); border-left: 3px solid var(--accent); padding:24px;">
                <div style="display:flex; justify-content:space-between; align-items:start; flex-wrap:wrap; gap:12px;">
                  <div style="flex:1; min-width:300px;">
                    <span class="pill" style="margin:0 0 12px 0;">${talk.type}</span>
                    <h3 style="margin:0; font-size:18px;">${talk.title}</h3>
                    <div class="muted" style="margin-top:8px; font-size:14px;">
                      <div>📍 ${talk.location}</div>
                      <div style="margin-top:4px;">🗓️ ${talk.date}</div>
                    </div>
                  </div>
                </div>
                ${talk.abstract ? `
                  <div style="margin-top:20px; padding-top:20px; border-top:1px solid var(--border);">
                    <div style="font-weight:600; font-size:14px; margin-bottom:8px;">${data.ui.sections.abstract}</div>
                    <p class="muted" style="font-size:13px; line-height:1.6; text-align:justify;">${talk.abstract}</p>
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </section>
        
    <!-- EDUCATION - CERTIFICATES -->
    <section id="education-certificates" class="section tabSection" data-tab="education">
      <div class="container">
        <div class="card" data-reveal>
          <h2>${data.ui.sections.certificates}</h2>
          <div class="grid2" style="margin-top:24px;">
            ${data.education.certificates.map(cert => `
              <div class="item card" style="background:var(--bg2); border-left: 3px solid var(--accent); padding:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <div style="font-weight:600; font-size:15px; color:var(--text);">${cert.title}</div>
                  <div class="pill" style="margin:0;">${cert.year}</div>
                </div>
                <!-- Additional detail placeholder if available -->
                ${cert.details ? `<div class="muted" style="font-size:13px; margin-top:8px;">${cert.details}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </section>

    <!-- EDUCATION - WORKSHOPS -->
    <section id="education-workshops" class="section tabSection" data-tab="education">
      <div class="container">
        <div class="card" data-reveal>
          <h2>${data.ui.sections.workshops}</h2>
          <div class="stack" style="margin-top:24px;">
            ${(data.education.workshops || []).map(w => `
              <div class="item" style="border-left:2px solid var(--accent); padding-left:24px;">
                <div style="font-weight:600; font-size:16px;">${w.title}</div>
                <div class="muted" style="font-size:13px;">${w.institution} | ${w.period}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </section>

    <!-- CONNECT -->
    <section id="connect" class="section tabSection" data-tab="connect">
      <div class="container">
        <div class="grid2">
           <div class="card" data-reveal>
              <h2>${data.ui.sections.scholarlyProfiles}</h2>
              <div class="stack" style="margin-top:24px;">
                <a class="link-ext" href="${data.basics.scholarUrl}" target="_blank">${data.ui.links.googleScholar}</a>
                <a class="link-ext" href="${data.basics.orcidUrl}" target="_blank">${data.ui.links.orcid}</a>
                <a class="link-ext" href="${data.basics.researchGateUrl}" target="_blank">${data.ui.links.researchGate}</a>
                <a class="link-ext" href="${data.basics.linkedinUrl}" target="_blank">${data.ui.links.linkedin}</a>
                ${data.basics.kfupmPureUrl ? `<a class="link-ext" href="${data.basics.kfupmPureUrl}" target="_blank">KFUPM Pure</a>` : ''}
              </div>
           </div>
           <div class="card" data-reveal>
              <h2>${data.ui.sections.communication}</h2>
              <p class="muted">${parseMarkdown(data.ui.sections.communicationText)}</p>
              <div class="stack" style="margin-top:20px;">
                <div><span class="muted">${data.ui.links.university}</span> <a class="link-ext" href="mailto:${data.basics.emailUni}">${data.basics.emailUni}</a></div>
                <div><span class="muted">${data.ui.links.personal}</span> <a class="link-ext" href="mailto:${data.basics.emailPersonal}">${data.basics.emailPersonal}</a></div>
              </div>
           </div>
        </div>
      </div>
    </section>
  `;

  updatePubList('all', 'all');
  updateProjectList('all');
  initFilterLogic();

  // Dynamic Project Filters
  const projBar = document.getElementById('project-filter-bar');
  if (projBar) {
    const categories = [...new Set(data.research.activeProjectsList.map(p => p.category).filter(c => c))];
    projBar.innerHTML = `<button class="filter-btn active" data-proj-filter="all">${data.ui.sections.allProjects}</button>` +
      categories.map(c => `<button class="filter-btn" data-proj-filter="${c}">${c}</button>`).join('');

    projBar.querySelectorAll('[data-proj-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        projBar.querySelectorAll('[data-proj-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateProjectList(btn.dataset.projFilter);
      });
    });
  }
}



function initFilterLogic() {
  let activeType = 'all';
  let activeCategory = 'all';

  function updateSubfilters() {
    const subBar = document.getElementById('subfilter-bar');
    if (!subBar) return;

    const allItems = [
      ...globalData.publications.articles.map(a => ({ ...a, type: 'article' })),
      ...globalData.publications.datasets.map(d => ({ ...d, type: 'dataset' })),
      ...globalData.publications.patents.map(p => ({ ...p, type: 'patent' }))
    ];

    // Filter items by type first to see which categories exist for this type
    const itemsOfType = activeType === 'all'
      ? allItems
      : allItems.filter(i => i.type === activeType);

    const categories = [...new Set(itemsOfType.map(i => i.category).filter(c => c))];

    // If current category isn't in new set, reset to all
    if (activeCategory !== 'all' && !categories.includes(activeCategory)) {
      activeCategory = 'all';
    }

    subBar.innerHTML = `<button class="filter-btn ${activeCategory === 'all' ? 'active' : ''}" data-category="all">${globalData.ui.filters.allTopics}</button>` +
      categories.map(c => `<button class="filter-btn ${activeCategory === c ? 'active' : ''}" data-category="${c}">${c}</button>`).join('');

    subBar.querySelectorAll('[data-category]').forEach(btn => {
      btn.addEventListener('click', () => {
        subBar.querySelectorAll('[data-category]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeCategory = btn.dataset.category;
        updatePubList(activeType, activeCategory);
      });
    });
  }

  document.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeType = btn.dataset.filter;
      updateSubfilters(); // Dynamic update!
      updatePubList(activeType, activeCategory);
    });
  });

  document.querySelectorAll('[data-proj-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-proj-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateProjectList(btn.dataset.projFilter);
    });
  });

  updateSubfilters(); // Initial load
}

function updateProjectList(filter) {
  const list = document.getElementById('project-list');
  if (!list) return;
  const filtered = filter === 'all'
    ? globalData.research.activeProjectsList
    : globalData.research.activeProjectsList.filter(p => p.category === filter);

  list.innerHTML = filtered.map(p => `
    <div class="item card" style="background:var(--bg2);">
      <h3>${p.title}</h3>
      <p class="muted" style="margin:8px 0;">${parseMarkdown(p.details)}</p>
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <span class="pill" style="margin:0;">${p.category}</span>
        <div style="display:flex; gap:12px; align-items:center;">
          ${p.links ? p.links.map(l => `<a href="${l.url}" target="_blank" class="link-ext">${l.icon || ''} ${l.text || globalData.ui.fallbacks.noLink}</a>`).join('') : ''}
          ${p.linkUrl ? `<a href="${p.linkUrl}" target="_blank" class="link-ext">${p.linkText || globalData.ui.fallbacks.noLink}</a>` : ''}
          ${p.linkUrl2 ? `<a href="${p.linkUrl2}" target="_blank" class="link-ext">${p.linkText2 || globalData.ui.fallbacks.noLink}</a>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

function updatePubList(typeFilter, categoryFilter) {
  const list = document.getElementById('pub-list');
  if (!list) return;

  const allItems = [
    ...globalData.publications.articles.map(a => ({ ...a, type: 'article' })),
    ...globalData.publications.datasets.map(d => ({ ...d, type: 'dataset' })),
    ...globalData.publications.patents.map(p => ({ ...p, type: 'patent' }))
  ];

  const filtered = allItems.filter(item => {
    const matchType = (typeFilter === 'all' || item.type === typeFilter);
    const matchCategory = (categoryFilter === 'all' || item.category === categoryFilter || item.type === categoryFilter);
    return matchType && matchCategory;
  });

  list.innerHTML = filtered.map(item => `
    <div class="item" style="border-bottom: 1px solid var(--border); border-radius:0; padding:16px 0;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
        <div style="font-weight:600; font-size:16px; margin-bottom:4px; color:var(--text);">${item.title || item.id}</div>
        ${item.category && item.category !== 'Unknown' ? `<span class="pill" style="font-size:10px;">${item.category}</span>` : ''}
      </div>
      
      ${(item.venue || item.year) ? `<div class="muted" style="font-size:13px; margin-bottom:8px;">${item.venue || (item.type === 'patent' ? globalData.ui.fallbacks.patentOffice : '')} ${item.year ? '• ' + item.year : ''}</div>` : ''}
      ${item.description ? `<p class="muted" style="font-size:14px; margin-bottom:12px;">${parseMarkdown(item.description)}</p>` : ''}
      
      <div style="display:flex; align-items:center; gap:16px; flex-wrap:wrap; margin-top:8px;">
        ${item.linkUrl && item.linkUrl !== '#' ? `<a href="${item.linkUrl}" target="_blank" class="link-ext" style="font-size:12px;">${item.linkText || globalData.ui.links.fullText}</a>` : ''}
        ${item.links ? item.links.filter(l => l.url && l.url !== '').map(l => `<a href="${l.url}" target="_blank" class="link-ext" style="font-size:12px;">${l.icon || ''} ${l.text || 'Link'}</a>`).join('') : ''}
        ${item.doi ? `<div class="altmetric-embed" data-badge-type="donut" data-doi="${item.doi}"></div>` : ''}
        ${item.arxiv ? `<a href="https://arxiv.org/abs/${item.arxiv}" target="_blank"><img src="https://img.shields.io/badge/arXiv-${item.arxiv}-B31B1B.svg?style=flat-square" /></a>` : ''}
      </div>
    </div>
  `).join('');

  if (window.AltmetricPhotos) { /* Refresh logic if needed */ }
}



function setupDemoModal() {
  const modalHTML = `
    <div id="demo-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.95); z-index:9999; flex-direction:column; align-items:center; justify-content:center; padding:20px; backdrop-filter:blur(5px);">
      <span id="demo-modal-close" style="position:absolute; top:20px; right:40px; font-size:50px; color:#fff; cursor:pointer; font-weight:100; line-height:1; z-index:10001;">&times;</span>
      
      <div style="position:relative; max-width:90vw; max-height:75vh; border-radius:12px; display:flex; justify-content:center; align-items:center; box-shadow:0 10px 30px rgba(0,0,0,0.5);">
         <div id="demo-modal-prev" style="position:absolute; left:-60px; top:50%; transform:translateY(-50%); font-size:40px; color:rgba(255,255,255,0.7); cursor:pointer; padding:20px; user-select:none; z-index:10000; display:none;">&#10094;</div>
         <div id="demo-modal-media" style="width:100%; height:100%; display:flex; justify-content:center; align-items:center; overflow:hidden; border-radius:12px;"></div>
         <div id="demo-modal-next" style="position:absolute; right:-60px; top:50%; transform:translateY(-50%); font-size:40px; color:rgba(255,255,255,0.7); cursor:pointer; padding:20px; user-select:none; z-index:10000; display:none;">&#10095;</div>
      </div>
      
      <div id="demo-modal-counter" style="color:var(--accent); font-size:12px; font-weight:bold; margin-top:16px; letter-spacing:1px; display:none;"></div>
      <h3 id="demo-modal-title" style="color:var(--text); margin-top:8px; text-align:center; font-family:'Outfit'; font-size:24px;"></h3>
      <p id="demo-modal-desc" style="color:var(--muted, #aaa); text-align:center; max-width:800px; margin-top:8px; font-size:15px;"></p>
      
      <div id="demo-modal-actions" style="margin-top:20px; display:none; gap:16px;">
         <a id="demo-modal-colab" href="#" target="_blank" class="btn" style="background:#f9ab00; color:#000; display:none;"><span style="margin-right:8px;">🚀</span> Run in Google Colab ↗</a>
         <button id="demo-modal-pyscript" class="btn" style="background:#306998; color:#fff; display:none; border:none; cursor:pointer;"><span style="margin-right:8px;">🐍</span> Run Local Terminal Demo</button>
         <a id="demo-modal-download" href="#" download class="btn" style="background:var(--accent); color:#000; display:none;"><span style="margin-right:8px;">📥</span> Download Script</a>
      </div>
      <p id="demo-modal-note" style="color:#ffcc00; font-size:12px; margin-top:10px; display:none;"></p>
      
      <!-- Code & Terminal Viewer -->
      <div id="demo-interactive-viewer" style="display:none; width:90vw; max-width:800px; margin-top:20px; text-align:left;">
         <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-size:12px; font-weight:bold; color:var(--accent);">PYTHON SOURCE CODE</span>
            <button id="close-interactive" style="background:none; border:none; color:#ff3333; cursor:pointer; font-size:12px;">Close Session ✕</button>
         </div>
         <pre id="demo-code-display" style="background:#1a1a1a; border:1px solid #333; border-radius:8px; padding:16px; font-size:13px; color:#ccc; overflow:auto; max-height:50vh; margin-bottom:16px; font-family:monospace;"></pre>
         
         <span style="font-size:12px; font-weight:bold; color:var(--accent);">TERMINAL OUTPUT</span>
         <div id="pyscript-output" style="background:#000; border:1px solid #333; border-radius:8px; padding:16px; font-size:13px; color:#00ff00; min-height:100px; max-height:300px; overflow-y:auto; font-family:monospace; margin-top:8px;"></div>
      </div>

    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  const modal = document.getElementById('demo-modal');
  const closeBtn = document.getElementById('demo-modal-close');
  const mediaContainer = document.getElementById('demo-modal-media');
  const titleEl = document.getElementById('demo-modal-title');
  const descEl = document.getElementById('demo-modal-desc');
  const prevBtn = document.getElementById('demo-modal-prev');
  const nextBtn = document.getElementById('demo-modal-next');
  const counterEl = document.getElementById('demo-modal-counter');

  const actionsContainer = document.getElementById('demo-modal-actions');
  const colabBtn = document.getElementById('demo-modal-colab');
  const pyscriptBtn = document.getElementById('demo-modal-pyscript');
  const downloadBtn = document.getElementById('demo-modal-download');
  const noteEl = document.getElementById('demo-modal-note');

  const interactiveViewer = document.getElementById('demo-interactive-viewer');
  const codeDisplay = document.getElementById('demo-code-display');
  const terminalOutput = document.getElementById('pyscript-output');
  const closeInteractiveBtn = document.getElementById('close-interactive');

  let currentDemo = null;
  let currentMediaIndex = 0;

  const renderMedia = () => {
    if (!currentDemo) return;
    const mediaList = currentDemo.media || [];

    // Safety check
    if (mediaList.length === 0) {
      const isScript = !!currentDemo.pyScript;
      const placeholder = isScript ? '🐍' : (globalData.ui.fallbacks && globalData.ui.fallbacks.noMedia || 'No Media');
      mediaContainer.innerHTML = `<div style="padding:100px; color:#fff; font-size:64px;">${placeholder}</div>`;
      prevBtn.style.display = 'none';
      nextBtn.style.display = 'none';
      counterEl.style.display = 'none';
      return;
    }

    const file = mediaList[currentMediaIndex] || '';
    let mediaHTML = '';
    if (file.toLowerCase().endsWith('.mp4')) {
      mediaHTML = `<video src="${file}" style="max-width:90vw; max-height:75vh; object-fit:contain;" controls autoplay></video>`;
    } else {
      mediaHTML = `<img src="${file}" style="max-width:90vw; max-height:75vh; object-fit:contain;" />`;
    }
    mediaContainer.innerHTML = mediaHTML;

    if (mediaList.length > 1) {
      prevBtn.style.display = 'block';
      nextBtn.style.display = 'block';
      counterEl.style.display = 'block';
      counterEl.innerText = `${currentMediaIndex + 1} / ${mediaList.length}`;
    } else {
      prevBtn.style.display = 'none';
      nextBtn.style.display = 'none';
      counterEl.style.display = 'none';
    }
  };

  closeInteractiveBtn.onclick = () => {
    interactiveViewer.style.display = 'none';
    mediaContainer.parentElement.style.display = 'flex';
    terminalOutput.innerHTML = '';
  };

  const executePyScript = async (scriptPath, isDesktopOnly = false) => {
    mediaContainer.parentElement.style.display = 'none';
    interactiveViewer.style.display = 'block';

    if (isDesktopOnly) {
      terminalOutput.innerHTML = `
            <div style="color:#ffcc00; background:rgba(255,204,0,0.1); padding:16px; border-radius:8px; border:1px solid rgba(255,204,0,0.3);">
                <div style="font-weight:bold; margin-bottom:8px;">🖥️ Desktop Application Only</div>
                This utility uses the <strong>Tkinter</strong> GUI library, which cannot run natively in a web browser. 
                You can review the source code above, or download it to run locally on your computer.
            </div>`;
    } else {
      terminalOutput.innerHTML = '<div style="color:#888;">Initializing Python environment...</div>';
    }

    try {
      const res = await fetch(scriptPath);
      const code = await res.text();

      // Show Source Code
      codeDisplay.textContent = code;

      if (!isDesktopOnly) {
        terminalOutput.innerHTML = '<div id="pyscript-manual-terminal" style="background:#000; color:#00ff00; font-family:Courier New, monospace; padding:15px; border-radius:4px; min-height:400px; white-space:pre-wrap; font-size:14px; line-height:1.4; border:1px solid #333; overflow-y:auto; max-height:500px;">Initializing Python environment...</div>';

        // Indent each line of the user's code to fit inside the try/except block
        const indentedCode = code.split('\n').map(line => '    ' + line).join('\n');

        // Use a dedicated tag for PyScript but manually redirect stdout to our div
        // This avoids the "py-terminal is read-only" bug on re-runs
        const scriptEl = document.createElement('script');
        scriptEl.type = 'py';
        scriptEl.textContent = `
import sys
import js

class TerminalWriter:
    def write(self, text):
        container = js.document.getElementById('pyscript-manual-terminal')
        if container:
            if container.innerHTML == 'Initializing Python environment...':
                container.innerHTML = ''
            container.innerText += text
            container.scrollTop = container.scrollHeight
    def flush(self):
        pass

sys.stdout = TerminalWriter()
sys.stderr = TerminalWriter()

# User Script
try:
${indentedCode}
except Exception as e:
    print(f"\\n[Error] {e}")
`;
        terminalOutput.appendChild(scriptEl);
      }

    } catch (err) {
      terminalOutput.innerHTML = `<div style="color:#ff3333;">Failed to load script: ${err}</div>`;
    }
  };

  const closeModal = () => {
    modal.style.display = 'none';
    mediaContainer.innerHTML = '';
    mediaContainer.parentElement.style.display = 'flex';
    interactiveViewer.style.display = 'none';
    terminalOutput.innerHTML = '';
    currentDemo = null;
  };

  prevBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!currentDemo || !currentDemo.media) return;
    currentMediaIndex = (currentMediaIndex - 1 + currentDemo.media.length) % currentDemo.media.length;
    renderMedia();
  });

  nextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!currentDemo || !currentDemo.media) return;
    currentMediaIndex = (currentMediaIndex + 1) % currentDemo.media.length;
    renderMedia();
  });

  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Event Delegation for Demos
  document.addEventListener('click', (e) => {
    const card = e.target.closest('[data-demo-index]');
    if (!card) return;

    const idx = card.getAttribute('data-demo-index');
    currentDemo = globalData.research.interactiveDemosList[idx];
    if (!currentDemo) return;

    currentMediaIndex = 0;
    titleEl.textContent = currentDemo.title;
    descEl.textContent = currentDemo.description;

    // Handle Interactive Code Buttons
    actionsContainer.style.display = 'none';
    colabBtn.style.display = 'none';
    pyscriptBtn.style.display = 'none';
    downloadBtn.style.display = 'none';
    noteEl.style.display = 'none';

    if (currentDemo.colabUrl || currentDemo.pyScript) {
      actionsContainer.style.display = 'flex';

      if (currentDemo.colabUrl) {
        colabBtn.href = currentDemo.colabUrl;
        colabBtn.style.display = 'inline-flex';
      }

      if (currentDemo.pyScript) {
        const isDesktop = !!currentDemo.isDesktopOnly;
        pyscriptBtn.style.display = 'inline-flex';
        pyscriptBtn.innerHTML = isDesktop ? '<span style="margin-right:8px;">🔍</span> View Source Code' : '<span style="margin-right:8px;">🐍</span> Run Local Terminal Demo';
        pyscriptBtn.onclick = () => executePyScript(currentDemo.pyScript, isDesktop);

        if (isDesktop) {
          downloadBtn.style.display = 'inline-flex';
          downloadBtn.href = currentDemo.pyScript;
          noteEl.style.display = 'block';
          noteEl.textContent = "Note: This is a desktop application. You can view the source code here, or download it to run locally.";
        }
      }
    }

    renderMedia();
    modal.style.display = 'flex';
  });
}

function setupNavigation() {
  const menuToggle = document.getElementById('menu-toggle');
  const navMenu = document.getElementById('nav-menu');

  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      navMenu.classList.toggle('open');
      menuToggle.textContent = navMenu.classList.contains('open') ? '✕' : '☰';
    });
  }

  function wireDropdown(dropdownId, buttonId) {
    const dd = document.getElementById(dropdownId);
    const btn = document.getElementById(buttonId);
    if (!dd || !btn) return;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = dd.classList.contains('open');
      document.querySelectorAll('.dropdown').forEach(menu => menu.classList.remove('open'));
      if (!wasOpen) dd.classList.add('open');
    });
    document.addEventListener('click', () => { dd.classList.remove('open'); });
  }

  wireDropdown('research-dd', 'researchBtn');
  wireDropdown('teaching-dd', 'teachingBtn');
  wireDropdown('education-dd', 'educationBtn');

  const TAB_IDS = new Set(['home', 'research', 'publications', 'teaching', 'education', 'connect']);

  function onHashChange() {
    let h = (location.hash || '').replace('#', '').trim();
    if (!h) h = 'home';

    const section = document.getElementById(h);
    if (!section || !section.classList.contains('tabSection')) {
      h = 'home';
    }

    // Force-close mobile menu on hash change
    if (navMenu && navMenu.classList.contains('open')) {
      navMenu.classList.remove('open');
      menuToggle.textContent = '☰';
    }

    // Force-close any open dropdown menus when changing tabs
    document.querySelectorAll('.drop-menu').forEach(menu => menu.classList.remove('open'));

    document.querySelectorAll('.tabSection').forEach(s => s.classList.remove('active'));
    document.getElementById(h).classList.add('active');

    // Updates link activity logic inside the top bar
    document.querySelectorAll('.nav-links a, .drop-menu a').forEach(a => {
      const href = a.getAttribute('href').replace('#', '');
      a.classList.toggle('active', href === h);
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
    initScrollReveal();
  }

  window.addEventListener('hashchange', onHashChange);
  onHashChange();
}
