let globalData = null;
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
  const loadingText = document.getElementById('loading-text');
  document.getElementById('year').textContent = new Date().getFullYear();

  try {
    const res = await fetch('content.json');
    if (!res.ok) throw new Error('Failed to load content');
    globalData = await res.json();
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

function renderContent(data) {
  const mount = document.getElementById('content-mount');

  document.getElementById('page-title').textContent = data.ui.meta.title;
  const metaDesc = document.getElementById('meta-description');
  if (metaDesc) metaDesc.setAttribute('content', data.ui.meta.description);

  document.getElementById('nav-name').textContent = data.basics.name;
  document.getElementById('nav-avatar').textContent = data.basics.avatar;
  document.getElementById('footer-name').textContent = data.basics.name;
  document.getElementById('footer-affiliation').textContent = data.basics.affiliation;

  // Populate nav labels from content.json
  const navMap = data.ui.nav;
  const navIds = {
    'nav-home': navMap.home, 'researchBtn': navMap.research,
    'nav-researchOverview': navMap.researchOverview, 'nav-researchThemes': navMap.researchThemes,
    'nav-researchProjects': navMap.researchProjects, 'nav-researchDemos': navMap.researchDemos,
    'nav-publications': navMap.publications, 'teachingBtn': navMap.teaching,
    'nav-teachingCourses': navMap.teachingCourses, 'educationBtn': navMap.education,
    'nav-educationDegrees': navMap.educationDegrees, 'nav-educationCertificates': navMap.educationCertificates,
    'nav-connect': navMap.connect
  };
  Object.entries(navIds).forEach(([id, text]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  });

  // Populate footer version
  const footerVer = document.getElementById('footer-version');
  if (footerVer) footerVer.textContent = data.ui.footer.version;

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
            <p class="lead">${data.basics.lead}</p>
            <div class="stack" style="flex-direction:row; gap:16px; margin-bottom:40px; flex-wrap:wrap;">
              <a class="btn" href="${data.basics.cvUrl}" target="_blank">${data.ui.hero.ctaPrimary}</a>
              <a class="btn secondary" href="outputs/CV_Generated.pdf" target="CV.pdf">${data.ui.hero.ctaGenerate}</a>
              <a class="btn secondary" href="#publications">${data.ui.hero.ctaSecondary}</a>
              <a class="btn" href="#research-demos">${data.ui.hero.ctaSamples}</a>
            </div>
            <div style="margin-top:24px;">
              ${data.basics.pills.map(p => `<span class="pill">${p}</span>`).join('')}
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
          <div class="card" style="display:grid; grid-template-columns: repeat(4, 1fr); gap:40px; text-align:center;">
             <div><div style="font-size:32px; font-weight:700; color:var(--accent);">${data.basics.metrics.citations}</div><div class="muted" style="font-size:11px;">${data.ui.quickFacts.labels.citations}</div></div>
             <div><div style="font-size:32px; font-weight:700; color:var(--accent);">${data.basics.metrics.hIndex}</div><div class="muted" style="font-size:11px;">${data.ui.quickFacts.labels.hIndex}</div></div>
             <div><div style="font-size:32px; font-weight:700; color:var(--accent);">${data.basics.metrics.hIndex5y}</div><div class="muted" style="font-size:11px;">${data.ui.quickFacts.labels.hIndex5y}</div></div>
             <div><div style="font-size:32px; font-weight:700; color:var(--accent);">${totalPubs}</div><div class="muted" style="font-size:11px;">${data.ui.quickFacts.labels.publications}</div></div>
             
             <div><div style="font-size:32px; font-weight:700; color:var(--accent);">${data.basics.metrics.i10Index}</div><div class="muted" style="font-size:11px;">${data.ui.quickFacts.labels.i10Index}</div></div>
             <div><div style="font-size:32px; font-weight:700; color:var(--accent);">${data.basics.metrics.i10Index5y}</div><div class="muted" style="font-size:11px;">${data.ui.quickFacts.labels.i10Index5y}</div></div>
             <div><div style="font-size:32px; font-weight:700; color:var(--accent); display: flex; align-items: center; justify-content: center; height: 38px;">${data.ui.quickFacts.labels.phdLabel}</div><div class="muted" style="font-size:11px;">${data.ui.quickFacts.labels.phdStatus}</div></div>
             <div><div style="font-size:32px; font-weight:700; color:var(--accent); display: flex; align-items: center; justify-content: center; height: 38px;">${data.basics.affiliation}</div><div class="muted" style="font-size:11px;">${data.ui.quickFacts.labels.affiliation}</div></div>
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
            ${data.education.map(e => `
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
          <p class="lead" style="margin-top:20px; max-width:100%;">${data.research.overview.text}</p>
          <div class="grid2" style="margin-top:40px;">
             <div class="card" style="background:var(--bg2); padding:30px; border: 1px solid var(--accent-dim);">
               <h3 style="margin-bottom:20px; font-size: 18px; color:var(--accent);">${data.ui.sections.researchAreas}</h3>
               <ul style="list-style:none; display:grid; grid-template-columns: 1fr; gap:16px;">
                 ${data.research.overview.researchAreas.map(s => `<li style="font-size:15px; display:flex; align-items:center; gap:8px;"><span style="color:var(--accent);">▹</span> ${s}</li>`).join('')}
               </ul>
             </div>
             <div class="card" style="background:var(--bg2); padding:30px; border: 1px solid var(--border);">
               <h3 style="margin-bottom:15px; font-size:16px;">${data.ui.sections.technicalSkills}</h3>
               <div>
                 <h4 style="font-size:12px; color:var(--accent); margin-bottom:6px;">${data.ui.sections.languagesFrameworks}</h4>
                 <div style="display:flex; flex-wrap:wrap; gap:6px;">
                   ${data.technicalSkills.languages.map(s => `<span class="pill" style="font-size:10px;">${s}</span>`).join('')}
                 </div>
               </div>
               <div style="margin-top:12px;">
                 <h4 style="font-size:12px; color:var(--accent); margin-bottom:6px;">${data.ui.sections.softwareTools}</h4>
                 <div style="display:flex; flex-wrap:wrap; gap:6px;">
                   ${data.technicalSkills.software.map(s => `<span class="pill" style="font-size:10px; opacity:0.8;">${s}</span>`).join('')}
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
            ${data.research.themes.map(t => `
              <div class="card item" data-reveal>
                <h3>${t.title}</h3>
                <p class="muted" style="margin-top:10px;">${t.description}</p>
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
            ${(data.research.demos || []).map((demo, i) => {
    const firstMedia = (demo.media && demo.media[0]) || '';
    const isVideo = firstMedia.toLowerCase().endsWith('.mp4');
    const icon = isVideo ? '🎬' : '🖼️';
    const badge = isVideo ? 'Video' : 'Image';
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
                <p class="muted" style="font-size:12px; margin-top:4px;">${demo.description}</p>
                <span class="pill" style="margin-top:8px; font-size:10px;">${badge}</span>
              </div>
            `}).join('')}
          </div>
        </div>
      </div>
    </section>

    <!-- INTERNSHIPS -->
    <section id="internships" class="section tabSection" data-tab="education">
      <div class="container">
        <div class="card" data-reveal>
          <h2>${data.ui.sections.professionalInternships}</h2>
          <div class="stack" style="margin-top:24px;">
            ${data.research.internships.map(i => `
              <div class="item" style="border-left:2px solid var(--accent); padding-left:24px;">
                <div style="font-weight:600; font-size:16px;">${i.title}</div>
                <div class="muted" style="font-size:13px;">${i.institution} | ${i.period}</div>
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
                  <span class="muted" style="font-size:12px;">${c.period}</span>
                </div>
                <div style="font-weight:600; font-size: 16px; margin-top:12px;">${c.title}</div>
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
            ${data.certificates.map(cert => `
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
              </div>
           </div>
           <div class="card" data-reveal>
              <h2>${data.ui.sections.communication}</h2>
              <p class="muted">${data.ui.sections.communicationText}</p>
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
    const categories = [...new Set(data.research.projects.map(p => p.category).filter(c => c))];
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
    ? globalData.research.projects
    : globalData.research.projects.filter(p => p.category === filter);

  list.innerHTML = filtered.map(p => `
    <div class="item card" style="background:var(--bg2);">
      <h3>${p.title}</h3>
      <p class="muted" style="margin:8px 0;">${p.details}</p>
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span class="pill">${p.category}</span>
        <a href="${p.linkUrl}" target="_blank" class="link-ext">${p.linkText || globalData.ui.fallbacks.noLink}</a>
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
      ${item.description ? `<p class="muted" style="font-size:14px; margin-bottom:12px;">${item.description}</p>` : ''}
      
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
      <h3 id="demo-modal-title" style="color:#fff; margin-top:8px; text-align:center; font-family:'Outfit'; font-size:24px;"></h3>
      <p id="demo-modal-desc" style="color:#aaa; text-align:center; max-width:800px; margin-top:8px; font-size:15px;"></p>
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

  let currentDemo = null;
  let currentMediaIndex = 0;

  const renderMedia = () => {
    if (!currentDemo) return;
    const mediaList = currentDemo.media || [];

    // Safety check
    if (mediaList.length === 0) {
      mediaContainer.innerHTML = `<div style="padding:100px; color:#fff;">${globalData.ui.fallbacks.noMedia}</div>`;
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

  const closeModal = () => {
    modal.style.display = 'none';
    mediaContainer.innerHTML = ''; // Stop video playback
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
    currentDemo = globalData.research.demos[idx];
    if (!currentDemo) return;

    currentMediaIndex = 0;
    titleEl.textContent = currentDemo.title;
    descEl.textContent = currentDemo.description;

    renderMedia();
    modal.style.display = 'flex';
  });
}

function setupNavigation() {
  function wireDropdown(dropdownId, buttonId) {
    const dd = document.getElementById(dropdownId);
    const btn = document.getElementById(buttonId);
    if (!dd || !btn) return;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = dd.classList.contains('open');
      document.querySelectorAll('.drop-menu').forEach(menu => menu.classList.remove('open'));
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
