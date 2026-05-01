// ===== NAVBAR =====
const navbar = document.getElementById('navbar');
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 50);
  updateActiveNav();
});

navToggle.addEventListener('click', () => {
  navLinks.classList.toggle('open');
  navToggle.classList.toggle('open');
});

document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', () => navLinks.classList.remove('open'));
});

function updateActiveNav() {
  const sections = ['presentation', 'projets', 'tps', 'competences', 'veille', 'contact'];
  let current = '';
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el && window.scrollY >= el.offsetTop - 200) current = id;
  });
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
  });
}

// ===== INTERSECTION OBSERVER (fade-in) =====
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      // Animate skill bars when competences section is visible
      if (entry.target.closest('#competences')) {
        animateSkillBars();
      }
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });

document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

// ===== LOAD DATA =====
let siteData = {};

async function loadData() {
  try {
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error('Erreur de chargement');
    siteData = await res.json();
    renderAll();
  } catch (err) {
    console.error('Erreur chargement données:', err);
  }
}

function renderAll() {
  renderSite(siteData.site);
  renderPresentation(siteData.presentation);
  renderProjets(siteData.projets?.items || []);
  renderTPs(siteData.tps?.items || []);
  renderCompetences(siteData.competences?.categories || []);
  renderVeille(siteData.veille?.items || []);
  renderContact(siteData.contact);
}

// ===== SITE SETTINGS =====
function renderSite(s) {
  if (!s) return;
  const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.textContent = val; };

  // Meta — titre géré ici uniquement, renderPresentation ne doit pas toucher document.title
  document.title = s.metaTitle || document.title;

  // Navbar
  set('nav-brand-text', s.navBrand);
  if (s.nav) {
    set('nav-link-presentation', s.nav.presentation);
    set('nav-link-projets', s.nav.projets);
    set('nav-link-tps', s.nav.tps);
    set('nav-link-competences', s.nav.competences);
    set('nav-link-veille', s.nav.veille);
    set('nav-link-contact', s.nav.contact);
  }

  // Section titles
  if (s.sections) {
    set('title-presentation', s.sections.presentation);
    set('title-projets', s.sections.projets);
    set('title-tps', s.sections.tps);
    set('title-competences', s.sections.competences);
    set('title-veille', s.sections.veille);
    set('title-contact', s.sections.contact);
  }

  // Présentation
  set('pres-about-title', s.presAbout);
  if (s.formation) {
    set('pres-specialite', s.formation.specialite);
    set('pres-annee', s.formation.annee);
  }

  // Info card
  if (s.terminal) {
    set('t-rep2', s.terminal.rep2);
    set('t-rep3', s.terminal.rep3);
  }
  if (s.formation) {
    set('t-annee', s.formation.annee);
  }

  // Hero buttons
  if (s.hero) {
    set('hero-btn1', s.hero.btn1);
    set('hero-btn2', s.hero.btn2);
  }

  // Contact section
  if (s.contactSection) {
    set('contact-titre', s.contactSection.titre);
    set('contact-intro', s.contactSection.intro);
  }

  // Footer
  set('footer-text', s.footer);
}

// ===== PRÉSENTATION =====
function renderPresentation(data) {
  if (!data) return;

  // Hero
  document.getElementById('hero-nom').textContent = data.nom || '';
  document.getElementById('hero-titre').textContent = data.titre || '';
  document.getElementById('hero-desc').textContent = data.description || '';
  document.getElementById('hero-localisation').textContent = data.localisation || '';
  document.getElementById('hero-ecole').textContent = data.ecole || 'BTS CIO option SISR';
  document.getElementById('footer-nom').textContent = data.nom || 'Étudiant';

  if (data.photo) {
    document.getElementById('hero-photo').src = data.photo;
    document.getElementById('hero-photo').style.display = 'block';
    document.getElementById('hero-photo-placeholder').style.display = 'none';
  } else {
    document.getElementById('hero-photo').style.display = 'none';
    document.getElementById('hero-photo-placeholder').style.display = 'flex';
  }

  // Section présentation
  document.getElementById('pres-description').textContent = data.description || '';
  document.getElementById('pres-ecole').textContent = data.ecole || '';
  document.getElementById('pres-localisation').textContent = data.localisation || '';

  // Terminal
  document.getElementById('t-nom').textContent = data.nom || '—';
  document.getElementById('t-localisation').textContent = data.localisation || '—';

}

// ===== PROJETS =====
function renderProjets(items) {
  const grid = document.getElementById('projets-grid');
  if (!items.length) {
    grid.innerHTML = `<div class="empty-state"><i class="fa-solid fa-folder-open"></i><p>Aucun projet pour le moment</p></div>`;
    return;
  }
  grid.innerHTML = items.map(p => cardHTML(p, 'projet')).join('');
  grid.querySelectorAll('.card').forEach(el => observer.observe(el));
}

// ===== TPs =====
function renderTPs(items) {
  const grid = document.getElementById('tps-grid');
  if (!items.length) {
    grid.innerHTML = `<div class="empty-state"><i class="fa-solid fa-flask"></i><p>Aucun TP pour le moment</p></div>`;
    return;
  }
  grid.innerHTML = items.map(tp => cardHTML(tp, 'tp')).join('');
  grid.querySelectorAll('.card').forEach(el => observer.observe(el));
}

function normalizeUrl(url) {
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function cardHTML(item, type) {
  const badge = type === 'projet'
    ? `<span class="card-badge badge-projet"><i class="fa-solid fa-folder"></i>Projet</span>`
    : '';

  const tags = (item.technologies || []).map(t => `<span class="tag">${esc(t)}</span>`).join('');
  const objectif = item.objectif ? `<p class="card-objectif"><i class="fa-solid fa-bullseye"></i> ${esc(item.objectif)}</p>` : '';
  const pdfFooter = item.pdf ? `
    <div class="card-footer">
      <a href="${item.pdf}" target="_blank" rel="noopener" class="btn-pdf">
        <i class="fa-solid fa-eye"></i> Voir
      </a>
      <a href="/api/pdf-download?url=${encodeURIComponent(item.pdf)}&filename=${encodeURIComponent(item.pdfNom || 'document.pdf')}" class="btn-pdf btn-pdf-dl">
        <i class="fa-solid fa-download"></i> Télécharger
      </a>
    </div>` : '';

  return `
    <div class="card fade-in">
      <div class="card-header">
        ${badge}
        <span class="card-date">${item.date || ''}</span>
      </div>
      <div class="card-body">
        <h3 class="card-title">${esc(item.titre || 'Sans titre')}</h3>
        <p class="card-desc">${esc(item.description || '')}</p>
        ${objectif}
      </div>
      ${tags ? `<div class="card-tags">${tags}</div>` : ''}
      ${pdfFooter}
    </div>
  `;
}

// ===== COMPÉTENCES =====
function renderCompetences(categories) {
  const wrapper = document.getElementById('competences-wrapper');
  if (!categories.length) {
    wrapper.innerHTML = '<p class="loading-text">Aucune compétence renseignée</p>';
    return;
  }
  wrapper.innerHTML = categories.map(cat => `
    <div class="competence-category fade-in">
      <div class="cat-header">
        <div class="cat-icon"><i class="fa-solid ${cat.icone || 'fa-star'}"></i></div>
        <h3 class="cat-title">${esc(cat.nom)}</h3>
      </div>
      <div class="skills-list">
        ${(cat.competences || []).map(skill => `
          <div class="skill-item">
            <span class="skill-name">${esc(skill.nom)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  wrapper.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
}

// ===== VEILLE =====
function renderVeille(items) {
  const grid = document.getElementById('veille-grid');
  if (!items.length) {
    grid.innerHTML = `<div class="empty-state"><i class="fa-solid fa-rss"></i><p>Aucun article de veille pour le moment</p></div>`;
    return;
  }
  const sorted = [...items].sort((a, b) => new Date(b.date) - new Date(a.date));
  grid.innerHTML = sorted.map(v => `
    <div class="veille-card fade-in">
      ${v.image
        ? `<img src="${v.image}" alt="${esc(v.titre)}" class="veille-image" loading="lazy">`
        : `<div class="veille-image-placeholder"><i class="fa-solid fa-rss"></i></div>`}
      <div class="veille-body">
        <div class="veille-meta">
          ${v.source ? `<span class="veille-source">${esc(v.source)}</span>` : ''}
          <span class="veille-date">${v.date || ''}</span>
        </div>
        <h3 class="veille-title">${esc(v.titre || 'Sans titre')}</h3>
        <p class="veille-resume">${esc(v.resume || '')}</p>
      </div>
      ${v.lien ? `
        <div class="veille-footer">
          <a href="${normalizeUrl(v.lien)}" target="_blank" rel="noopener" class="veille-link">
            Lire l'article <i class="fa-solid fa-arrow-up-right-from-square"></i>
          </a>
        </div>` : ''}
    </div>
  `).join('');

  grid.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
}

// ===== CONTACT =====
function renderContact(data) {
  if (!data) return;

  const items = document.getElementById('contact-items');
  const contactData = [
    { icon: 'fa-envelope', label: 'Email', value: data.email, href: `mailto:${data.email}` },
    { icon: 'fa-phone', label: 'Téléphone', value: data.telephone, href: `tel:${data.telephone}` }
  ];

  items.innerHTML = contactData
    .filter(c => c.value)
    .map(c => `
      <div class="contact-item">
        <div class="contact-item-icon"><i class="fa-solid ${c.icon}"></i></div>
        <div class="contact-item-text">
          <strong>${c.label}</strong>
          <a href="${c.href}">${esc(c.value)}</a>
        </div>
      </div>
    `).join('');

  const socials = document.getElementById('contact-socials');
  const socialLinks = [
    { icon: 'fa-brands fa-linkedin-in', url: data.linkedin, label: 'LinkedIn' },
    { icon: 'fa-brands fa-github', url: data.github, label: 'GitHub' }
  ];

  socials.innerHTML = socialLinks
    .filter(s => s.url)
    .map(s => `<a href="${normalizeUrl(s.url)}" target="_blank" rel="noopener" class="social-btn" title="${s.label}"><i class="${s.icon}"></i></a>`)
    .join('');

  const cvWrapper = document.getElementById('contact-cv-wrapper');
  const cvTitre = siteData.site?.contactSection?.cvTitre || 'Mon Curriculum Vitæ';
  const cvDesc = siteData.site?.contactSection?.cvDesc || 'Téléchargez mon CV pour en savoir plus sur mon parcours et mes compétences.';
  if (data.cv) {
    cvWrapper.innerHTML = `
      <div class="cv-icon"><i class="fa-solid fa-file-pdf"></i></div>
      <h4>${esc(cvTitre)}</h4>
      <p>${esc(cvDesc)}</p>
      <a href="${data.cv}" download="${data.cvNom || 'CV.pdf'}" class="btn btn-primary">
        <i class="fa-solid fa-download"></i> Télécharger le CV
      </a>
    `;
  } else {
    cvWrapper.innerHTML = `
      <div class="cv-icon" style="opacity:0.4"><i class="fa-solid fa-file-pdf"></i></div>
      <h4>Curriculum Vitæ</h4>
      <p style="color:var(--text-muted)">CV non encore disponible.</p>
    `;
  }
}

// ===== UTILS =====
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ===== INIT =====
loadData();
