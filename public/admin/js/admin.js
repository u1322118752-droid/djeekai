// ===== STATE =====
let data = {};
let token = localStorage.getItem('admin_token');
let currentModal = { type: null, id: null };
let competencesState = [];

// ===== INIT =====
(async function init() {
  if (!token) { window.location.href = '/admin'; return; }

  const ok = await verifyToken();
  if (!ok) { logout(); return; }

  await loadAllData();
  renderDashboard();
  renderPresentationForm();
  renderProjetsList();
  renderTPsList();
  renderCompetencesAdmin();
  renderVeilleList();
  renderContactForm();
  renderSiteForm();
})();

async function verifyToken() {
  try {
    const res = await apiFetch('/api/admin/verify');
    return res.ok;
  } catch { return false; }
}

// ===== API =====
async function apiFetch(url, opts = {}) {
  return fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {})
    }
  });
}

async function apiJSON(url, method = 'GET', body = null) {
  const opts = { method };
  if (body) opts.body = JSON.stringify(body);
  const res = await apiFetch(url, opts);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Erreur serveur');
  return json;
}

async function apiUpload(url, formData) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Erreur upload');
  return json;
}

async function loadAllData() {
  const res = await fetch('/api/data');
  data = await res.json();
  competencesState = JSON.parse(JSON.stringify(data.competences?.categories || []));
}

// ===== SIDEBAR =====
function showSection(name) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));

  document.getElementById(`section-${name}`).classList.add('active');
  const labelMap = {
    dashboard: 'tableau', presentation: 'présentation', projets: 'projets',
    tps: 'travaux', competences: 'compétences', veille: 'veille',
    contact: 'cv &', personnalisation: 'personnalisation', parametres: 'paramètres'
  };
  const needle = labelMap[name] || name;
  document.querySelectorAll('.sidebar-link').forEach(l => {
    if (l.textContent.trim().toLowerCase().includes(needle)) l.classList.add('active');
  });

  const titles = {
    dashboard: 'Tableau de bord', presentation: 'Présentation', projets: 'Projets',
    tps: 'Travaux Pratiques', competences: 'Compétences', veille: 'Veille Technologique',
    contact: 'CV & Contact', personnalisation: 'Personnalisation du site', parametres: 'Paramètres'
  };
  document.getElementById('topbar-title').textContent = titles[name] || name;

  if (window.innerWidth < 900) closeSidebar();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
}

// ===== DASHBOARD =====
function renderDashboard() {
  document.getElementById('stat-projets').textContent = data.projets?.items?.length || 0;
  document.getElementById('stat-tps').textContent = data.tps?.items?.length || 0;
  document.getElementById('stat-veille').textContent = data.veille?.items?.length || 0;
  const totalSkills = (data.competences?.categories || []).reduce((a, c) => a + (c.competences?.length || 0), 0);
  document.getElementById('stat-competences').textContent = totalSkills;
}

// ===== PRÉSENTATION =====
function renderPresentationForm() {
  const p = data.presentation || {};
  document.getElementById('pres-nom').value = p.nom || '';
  document.getElementById('pres-titre').value = p.titre || '';
  document.getElementById('pres-ecole').value = p.ecole || '';
  document.getElementById('pres-localisation').value = p.localisation || '';
  document.getElementById('pres-description').value = p.description || '';

  if (p.photo) {
    document.getElementById('photo-preview').src = p.photo;
    document.getElementById('photo-preview').style.display = 'block';
    document.getElementById('photo-placeholder').style.display = 'none';
  }
}

async function savePresentation() {
  try {
    const payload = {
      nom: document.getElementById('pres-nom').value,
      titre: document.getElementById('pres-titre').value,
      ecole: document.getElementById('pres-ecole').value,
      localisation: document.getElementById('pres-localisation').value,
      description: document.getElementById('pres-description').value
    };
    await apiJSON('/api/admin/presentation', 'PUT', payload);
    data.presentation = { ...data.presentation, ...payload };
    toast('success', 'Présentation sauvegardée', 'Les modifications ont été enregistrées.');
  } catch (err) {
    toast('error', 'Erreur', err.message);
  }
}

async function previewAndUploadPhoto(input) {
  const file = input.files[0];
  if (!file) return;

  // Preview
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('photo-preview').src = e.target.result;
    document.getElementById('photo-preview').style.display = 'block';
    document.getElementById('photo-placeholder').style.display = 'none';
  };
  reader.readAsDataURL(file);

  // Upload
  try {
    const fd = new FormData();
    fd.append('photo', file);
    const result = await apiUpload('/api/admin/presentation/photo', fd);
    data.presentation.photo = result.photo;
    toast('success', 'Photo uploadée', 'Votre photo de profil a été mise à jour.');
  } catch (err) {
    toast('error', 'Erreur upload', err.message);
  }
}

// ===== PROJETS =====
function renderProjetsList() {
  const list = document.getElementById('projets-list');
  const items = data.projets?.items || [];
  if (!items.length) {
    list.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:40px;">Aucun projet. Cliquez sur "Ajouter un projet" pour commencer.</p>';
    return;
  }
  list.innerHTML = items.map(p => listItemHTML(p, 'projet')).join('');
  setupDragDrop('projet');
}

function renderTPsList() {
  const list = document.getElementById('tps-list');
  const items = data.tps?.items || [];
  if (!items.length) {
    list.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:40px;">Aucun TP. Cliquez sur "Ajouter un TP" pour commencer.</p>';
    return;
  }
  list.innerHTML = items.map(tp => listItemHTML(tp, 'tp')).join('');
  setupDragDrop('tp');
}

function listItemHTML(item, type) {
  const typePath = type === 'tp' ? 'tps' : 'projets';
  const typeLabel = type === 'tp' ? 'TP' : 'Projet';
  const objectifField = type === 'tp' ? `
    <div class="form-group">
      <label class="form-label">Objectif du TP</label>
      <input type="text" class="form-input" id="${type}-objectif-${item.id}" value="${esc(item.objectif || '')}" placeholder="Objectif pédagogique..." />
    </div>` : '';

  const techsValue = (item.technologies || []).join(', ');

  const pdfSection = item.pdf
    ? `<div class="upload-file-info" id="${type}-pdf-info-${item.id}">
        <i class="fa-solid fa-file-pdf"></i>
        <span class="upload-file-name">${esc(item.pdfNom || 'document.pdf')}</span>
        <button class="btn btn-danger btn-sm btn-icon" onclick="deletePDF('${typePath}', ${item.id})" title="Supprimer le PDF">
          <i class="fa-solid fa-trash"></i>
        </button>
        <a href="${item.pdf}" target="_blank" class="btn btn-outline btn-sm"><i class="fa-solid fa-eye"></i></a>
      </div>
      <div class="upload-zone compact" id="${type}-dropzone-${item.id}" data-id="${item.id}" data-type="${typePath}">
        <input type="file" accept=".pdf" onchange="uploadPDF('${typePath}', ${item.id}, this)" />
        <p class="upload-text" style="font-size:0.82rem;"><i class="fa-solid fa-rotate"></i> Remplacer le PDF</p>
      </div>`
    : `<div class="upload-zone" id="${type}-dropzone-${item.id}" data-id="${item.id}" data-type="${typePath}">
        <input type="file" accept=".pdf" onchange="uploadPDF('${typePath}', ${item.id}, this)" />
        <div class="upload-icon" style="font-size:1.5rem;"><i class="fa-solid fa-file-pdf"></i></div>
        <p class="upload-text"><strong>Glisser le PDF</strong> ou cliquer</p>
        <p class="upload-hint">PDF uniquement — max 10 Mo</p>
      </div>`;

  return `
    <div class="list-item" id="${type}-item-${item.id}">
      <div class="list-item-header" onclick="toggleItem('${type}-item-${item.id}')">
        <i class="fa-solid fa-chevron-down list-item-toggle" id="toggle-${type}-${item.id}"></i>
        <span class="list-item-title">${esc(item.titre || 'Sans titre')}</span>
        <span class="list-item-meta">${item.date || ''}</span>
        <div class="list-item-actions" onclick="event.stopPropagation()">
          <button class="btn btn-primary btn-sm" onclick="saveItem('${typePath}', ${item.id})">
            <i class="fa-solid fa-floppy-disk"></i> Sauver
          </button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="deleteItem('${typePath}', ${item.id})" title="Supprimer">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
      <div class="list-item-body" id="body-${type}-item-${item.id}">
        <div class="form-group">
          <label class="form-label">Titre</label>
          <input type="text" class="form-input" id="${type}-titre-${item.id}" value="${esc(item.titre || '')}" placeholder="Titre du ${typeLabel}..." />
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea class="form-textarea" id="${type}-desc-${item.id}" rows="3" placeholder="Description...">${esc(item.description || '')}</textarea>
        </div>
        ${objectifField}
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Technologies (séparées par des virgules)</label>
            <input type="text" class="form-input" id="${type}-tech-${item.id}" value="${esc(techsValue)}" placeholder="Cisco, Linux, Windows Server..." />
          </div>
          <div class="form-group">
            <label class="form-label">Date</label>
            <input type="date" class="form-input" id="${type}-date-${item.id}" value="${item.date || ''}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label"><i class="fa-solid fa-file-pdf"></i> Document PDF</label>
          ${pdfSection}
        </div>
      </div>
    </div>
  `;
}

function toggleItem(id) {
  const body = document.getElementById(`body-${id}`);
  const toggle = body.previousElementSibling.querySelector('.list-item-toggle');
  body.classList.toggle('open');
  toggle.classList.toggle('open');
}

async function saveItem(type, id) {
  try {
    const typeSingular = type === 'tps' ? 'tp' : 'projet';
    const titre = document.getElementById(`${typeSingular}-titre-${id}`)?.value || '';
    const description = document.getElementById(`${typeSingular}-desc-${id}`)?.value || '';
    const techsRaw = document.getElementById(`${typeSingular}-tech-${id}`)?.value || '';
    const date = document.getElementById(`${typeSingular}-date-${id}`)?.value || '';
    const objectif = document.getElementById(`${typeSingular}-objectif-${id}`)?.value || '';

    const payload = {
      titre,
      description,
      technologies: techsRaw.split(',').map(t => t.trim()).filter(Boolean),
      date
    };
    if (objectif !== undefined) payload.objectif = objectif;

    await apiJSON(`/api/admin/${type}/${id}`, 'PUT', payload);

    // Update title in header
    const titleEl = document.querySelector(`#${typeSingular}-item-${id} .list-item-title`);
    if (titleEl) titleEl.textContent = titre || 'Sans titre';

    // Update local data
    const dataKey = type === 'tps' ? 'tps' : 'projets';
    const idx = data[dataKey].items.findIndex(i => i.id == id);
    if (idx !== -1) data[dataKey].items[idx] = { ...data[dataKey].items[idx], ...payload };
    renderDashboard();

    toast('success', 'Enregistré', `${typeSingular === 'tp' ? 'TP' : 'Projet'} mis à jour avec succès.`);
  } catch (err) {
    toast('error', 'Erreur', err.message);
  }
}

async function deleteItem(type, id) {
  if (!confirm('Supprimer cet élément ? Cette action est irréversible.')) return;
  try {
    await apiJSON(`/api/admin/${type}/${id}`, 'DELETE');
    const dataKey = type === 'tps' ? 'tps' : 'projets';
    data[dataKey].items = data[dataKey].items.filter(i => i.id != id);
    if (type === 'tps') renderTPsList();
    else renderProjetsList();
    renderDashboard();
    toast('success', 'Supprimé', 'L\'élément a été supprimé.');
  } catch (err) {
    toast('error', 'Erreur', err.message);
  }
}

async function uploadPDF(type, id, input) {
  const file = input.files[0];
  if (!file) return;
  try {
    const fd = new FormData();
    fd.append('pdf', file);
    const result = await apiUpload(`/api/admin/${type}/${id}/pdf`, fd);
    const typeSingular = type === 'tps' ? 'tp' : 'projet';
    const dataKey = type;
    const idx = data[dataKey].items.findIndex(i => i.id == id);
    if (idx !== -1) {
      data[dataKey].items[idx].pdf = result.pdf;
      data[dataKey].items[idx].pdfNom = result.pdfNom;
    }
    if (type === 'tps') renderTPsList();
    else renderProjetsList();
    toast('success', 'PDF uploadé', file.name);
  } catch (err) {
    toast('error', 'Erreur upload', err.message);
  }
}

async function deletePDF(type, id) {
  if (!confirm('Supprimer ce PDF ?')) return;
  try {
    await apiJSON(`/api/admin/${type}/${id}/pdf`, 'DELETE');
    const idx = data[type].items.findIndex(i => i.id == id);
    if (idx !== -1) { data[type].items[idx].pdf = ''; data[type].items[idx].pdfNom = ''; }
    if (type === 'tps') renderTPsList();
    else renderProjetsList();
    toast('success', 'PDF supprimé', '');
  } catch (err) {
    toast('error', 'Erreur', err.message);
  }
}

function setupDragDrop(type) {
  const typePath = type === 'tp' ? 'tps' : 'projets';
  document.querySelectorAll(`[data-type="${typePath}"]`).forEach(zone => {
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragging'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragging'));
    zone.addEventListener('drop', async (e) => {
      e.preventDefault();
      zone.classList.remove('dragging');
      const file = e.dataTransfer.files[0];
      if (!file || file.type !== 'application/pdf') { toast('error', 'Fichier invalide', 'Seuls les PDF sont acceptés.'); return; }
      const id = zone.dataset.id;
      const fd = new FormData();
      fd.append('pdf', file);
      try {
        const result = await apiUpload(`/api/admin/${typePath}/${id}/pdf`, fd);
        const idx = data[typePath].items.findIndex(i => i.id == id);
        if (idx !== -1) { data[typePath].items[idx].pdf = result.pdf; data[typePath].items[idx].pdfNom = result.pdfNom; }
        if (typePath === 'tps') renderTPsList();
        else renderProjetsList();
        toast('success', 'PDF uploadé', file.name);
      } catch (err) {
        toast('error', 'Erreur upload', err.message);
      }
    });
  });
}

// ===== MODAL ADD =====
function openAddModal(type) {
  currentModal = { type, id: null };
  const isProjet = type === 'projet';
  const isVeille = type === 'veille';

  document.getElementById('modal-title').textContent = isVeille ? 'Nouvel article de veille' : `Nouveau ${isProjet ? 'projet' : 'TP'}`;

  let body = '';
  if (isVeille) {
    body = `
      <div class="form-group">
        <label class="form-label">Titre de l'article</label>
        <input type="text" class="form-input" id="modal-titre" placeholder="Titre..." />
      </div>
      <div class="form-group">
        <label class="form-label">Source</label>
        <input type="text" class="form-input" id="modal-source" placeholder="ex: LeMagIT, ANSSI, ZDNet..." />
      </div>
      <div class="form-group">
        <label class="form-label">Résumé</label>
        <textarea class="form-textarea" id="modal-resume" rows="4" placeholder="Résumé de l'article..."></textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Lien vers l'article</label>
          <input type="url" class="form-input" id="modal-lien" placeholder="https://..." />
        </div>
        <div class="form-group">
          <label class="form-label">Date</label>
          <input type="date" class="form-input" id="modal-date" value="${new Date().toISOString().split('T')[0]}" />
        </div>
      </div>
    `;
  } else {
    const objectifField = !isProjet ? `
      <div class="form-group">
        <label class="form-label">Objectif pédagogique</label>
        <input type="text" class="form-input" id="modal-objectif" placeholder="Objectif du TP..." />
      </div>` : '';
    body = `
      <div class="form-group">
        <label class="form-label">Titre</label>
        <input type="text" class="form-input" id="modal-titre" placeholder="Titre du ${isProjet ? 'projet' : 'TP'}..." />
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-textarea" id="modal-desc" rows="3" placeholder="Description..."></textarea>
      </div>
      ${objectifField}
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Technologies</label>
          <input type="text" class="form-input" id="modal-tech" placeholder="Cisco, Linux, VLAN..." />
          <span class="form-hint">Séparées par des virgules</span>
        </div>
        <div class="form-group">
          <label class="form-label">Date</label>
          <input type="date" class="form-input" id="modal-date" value="${new Date().toISOString().split('T')[0]}" />
        </div>
      </div>
    `;
  }

  document.getElementById('modal-body').innerHTML = body;
  document.getElementById('modal').style.display = 'flex';
  setTimeout(() => document.getElementById('modal-titre')?.focus(), 100);
}

async function saveModal() {
  const { type } = currentModal;
  const titre = document.getElementById('modal-titre')?.value?.trim();
  if (!titre) { toast('error', 'Champ requis', 'Le titre est obligatoire.'); return; }

  try {
    let payload = { titre };

    if (type === 'veille') {
      payload = {
        titre,
        source: document.getElementById('modal-source')?.value || '',
        resume: document.getElementById('modal-resume')?.value || '',
        lien: document.getElementById('modal-lien')?.value || '',
        date: document.getElementById('modal-date')?.value || new Date().toISOString().split('T')[0]
      };
      const result = await apiJSON('/api/admin/veille', 'POST', payload);
      data.veille.items.push(result);
      renderVeilleList();
    } else if (type === 'projet') {
      payload = {
        titre,
        description: document.getElementById('modal-desc')?.value || '',
        technologies: (document.getElementById('modal-tech')?.value || '').split(',').map(t => t.trim()).filter(Boolean),
        date: document.getElementById('modal-date')?.value || new Date().toISOString().split('T')[0]
      };
      const result = await apiJSON('/api/admin/projets', 'POST', payload);
      data.projets.items.push(result);
      renderProjetsList();
    } else {
      payload = {
        titre,
        description: document.getElementById('modal-desc')?.value || '',
        objectif: document.getElementById('modal-objectif')?.value || '',
        technologies: (document.getElementById('modal-tech')?.value || '').split(',').map(t => t.trim()).filter(Boolean),
        date: document.getElementById('modal-date')?.value || new Date().toISOString().split('T')[0]
      };
      const result = await apiJSON('/api/admin/tps', 'POST', payload);
      data.tps.items.push(result);
      renderTPsList();
    }

    renderDashboard();
    closeModal();
    toast('success', 'Ajouté', `"${titre}" a été créé avec succès.`);
  } catch (err) {
    toast('error', 'Erreur', err.message);
  }
}

function closeModal() {
  document.getElementById('modal').style.display = 'none';
  currentModal = { type: null, id: null };
}

function closeModalOnOverlay(e) {
  if (e.target === document.getElementById('modal')) closeModal();
}

// ===== VEILLE =====
function renderVeilleList() {
  const list = document.getElementById('veille-list');
  const items = data.veille?.items || [];
  if (!items.length) {
    list.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:40px;">Aucun article. Cliquez sur "Ajouter un article" pour commencer.</p>';
    return;
  }
  const sorted = [...items].sort((a, b) => new Date(b.date) - new Date(a.date));
  list.innerHTML = sorted.map(v => `
    <div class="list-item" id="veille-item-${v.id}">
      <div class="list-item-header" onclick="toggleItem('veille-item-${v.id}')">
        <i class="fa-solid fa-chevron-down list-item-toggle" id="toggle-veille-${v.id}"></i>
        <span class="list-item-title">${esc(v.titre || 'Sans titre')}</span>
        <span class="list-item-meta">${v.source ? `[${esc(v.source)}] ` : ''}${v.date || ''}</span>
        <div class="list-item-actions" onclick="event.stopPropagation()">
          <button class="btn btn-primary btn-sm" onclick="saveVeille(${v.id})"><i class="fa-solid fa-floppy-disk"></i> Sauver</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="deleteVeille(${v.id})" title="Supprimer"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
      <div class="list-item-body" id="body-veille-item-${v.id}">
        <div class="form-group">
          <label class="form-label">Titre</label>
          <input type="text" class="form-input" id="veille-titre-${v.id}" value="${esc(v.titre || '')}" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Source</label>
            <input type="text" class="form-input" id="veille-source-${v.id}" value="${esc(v.source || '')}" placeholder="LeMagIT, ANSSI..." />
          </div>
          <div class="form-group">
            <label class="form-label">Date</label>
            <input type="date" class="form-input" id="veille-date-${v.id}" value="${v.date || ''}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Résumé</label>
          <textarea class="form-textarea" id="veille-resume-${v.id}" rows="3">${esc(v.resume || '')}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Lien vers l'article</label>
          <input type="url" class="form-input" id="veille-lien-${v.id}" value="${esc(v.lien || '')}" placeholder="https://..." />
        </div>
      </div>
    </div>
  `).join('');
}

async function saveVeille(id) {
  try {
    const payload = {
      titre: document.getElementById(`veille-titre-${id}`)?.value || '',
      source: document.getElementById(`veille-source-${id}`)?.value || '',
      date: document.getElementById(`veille-date-${id}`)?.value || '',
      resume: document.getElementById(`veille-resume-${id}`)?.value || '',
      lien: document.getElementById(`veille-lien-${id}`)?.value || ''
    };
    await apiJSON(`/api/admin/veille/${id}`, 'PUT', payload);
    const idx = data.veille.items.findIndex(v => v.id == id);
    if (idx !== -1) data.veille.items[idx] = { ...data.veille.items[idx], ...payload };
    const titleEl = document.querySelector(`#veille-item-${id} .list-item-title`);
    if (titleEl) titleEl.textContent = payload.titre || 'Sans titre';
    toast('success', 'Article sauvegardé', '');
  } catch (err) {
    toast('error', 'Erreur', err.message);
  }
}

async function deleteVeille(id) {
  if (!confirm('Supprimer cet article ?')) return;
  try {
    await apiJSON(`/api/admin/veille/${id}`, 'DELETE');
    data.veille.items = data.veille.items.filter(v => v.id != id);
    renderVeilleList();
    renderDashboard();
    toast('success', 'Supprimé', '');
  } catch (err) {
    toast('error', 'Erreur', err.message);
  }
}

// ===== COMPÉTENCES =====
const ICONS = ['fa-network-wired','fa-server','fa-shield-halved','fa-code','fa-database','fa-cloud','fa-wifi','fa-lock','fa-terminal','fa-microchip','fa-globe','fa-sitemap'];

function renderCompetencesAdmin() {
  const container = document.getElementById('skills-admin');
  if (!competencesState.length) {
    container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:40px;">Aucune catégorie. Cliquez sur "Catégorie" pour en ajouter une.</p>';
    return;
  }
  container.innerHTML = competencesState.map((cat, ci) => `
    <div class="category-admin edit-card" data-cat="${ci}">
      <div class="edit-card-header">
        <div style="display:flex; align-items:center; gap:10px; flex:1;">
          <div class="cat-icon" style="background:rgba(37,99,235,0.1); color:var(--accent-light); width:36px; height:36px; border-radius:8px; display:flex; align-items:center; justify-content:center;">
            <i class="fa-solid ${cat.icone || 'fa-star'}"></i>
          </div>
          <input type="text" value="${esc(cat.nom)}" placeholder="Nom de la catégorie"
            oninput="competencesState[${ci}].nom = this.value"
            style="flex:1; background:transparent; border:none; color:var(--text); font-family:var(--font); font-size:0.95rem; font-weight:700; outline:none;" />
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <select class="form-select" style="width:auto; padding:6px 10px; font-size:0.82rem;" onchange="competencesState[${ci}].icone = this.value; renderCompetencesAdmin()">
            ${ICONS.map(ic => `<option value="${ic}" ${cat.icone === ic ? 'selected' : ''}>${ic.replace('fa-','')}</option>`).join('')}
          </select>
          <button class="btn btn-danger btn-sm btn-icon" onclick="removeCategory(${ci})"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
      <div class="edit-card-body" style="gap:10px;">
        ${(cat.competences || []).map((sk, si) => `
          <div class="skill-admin-row">
            <input type="text" value="${esc(sk.nom)}" placeholder="Nom de la compétence"
              oninput="competencesState[${ci}].competences[${si}].nom = this.value" />
            <button class="btn btn-ghost btn-sm btn-icon" onclick="removeSkill(${ci}, ${si})" title="Supprimer">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        `).join('')}
        <button class="btn btn-outline btn-sm" onclick="addSkill(${ci})" style="margin-top:4px;">
          <i class="fa-solid fa-plus"></i> Ajouter une compétence
        </button>
      </div>
    </div>
  `).join('');
}

function addCategory() {
  competencesState.push({ id: Date.now(), nom: 'Nouvelle catégorie', icone: 'fa-star', competences: [] });
  renderCompetencesAdmin();
}

function removeCategory(ci) {
  if (!confirm('Supprimer cette catégorie et toutes ses compétences ?')) return;
  competencesState.splice(ci, 1);
  renderCompetencesAdmin();
}

function addSkill(ci) {
  if (!competencesState[ci].competences) competencesState[ci].competences = [];
  competencesState[ci].competences.push({ id: Date.now(), nom: '', niveau: 70 });
  renderCompetencesAdmin();
}

function removeSkill(ci, si) {
  competencesState[ci].competences.splice(si, 1);
  renderCompetencesAdmin();
}

async function saveCompetences() {
  try {
    const payload = { categories: competencesState };
    await apiJSON('/api/admin/competences', 'PUT', payload);
    data.competences = payload;
    renderDashboard();
    toast('success', 'Compétences sauvegardées', 'Toutes les compétences ont été mises à jour.');
  } catch (err) {
    toast('error', 'Erreur', err.message);
  }
}

// ===== CONTACT =====
function renderContactForm() {
  const c = data.contact || {};
  document.getElementById('contact-email').value = c.email || '';
  document.getElementById('contact-telephone').value = c.telephone || '';
  document.getElementById('contact-linkedin').value = c.linkedin || '';
  document.getElementById('contact-github').value = c.github || '';

  const cvInfo = document.getElementById('cv-current-info');
  if (c.cv) {
    cvInfo.innerHTML = `
      <div class="upload-file-info" style="margin-bottom:12px;">
        <i class="fa-solid fa-file-pdf"></i>
        <span class="upload-file-name">${esc(c.cvNom || 'CV.pdf')}</span>
        <a href="${c.cv}" target="_blank" class="btn btn-outline btn-sm"><i class="fa-solid fa-eye"></i> Voir</a>
        <button class="btn btn-danger btn-sm" onclick="deleteCV()"><i class="fa-solid fa-trash"></i> Supprimer</button>
      </div>
    `;
  } else {
    cvInfo.innerHTML = '';
  }
}

async function saveContact() {
  try {
    const payload = {
      email: document.getElementById('contact-email').value,
      telephone: document.getElementById('contact-telephone').value,
      linkedin: document.getElementById('contact-linkedin').value,
      github: document.getElementById('contact-github').value
    };
    await apiJSON('/api/admin/contact', 'PUT', payload);
    data.contact = { ...data.contact, ...payload };
    toast('success', 'Contact sauvegardé', '');
  } catch (err) {
    toast('error', 'Erreur', err.message);
  }
}

async function uploadCV(input) {
  const file = input.files[0];
  if (!file) return;
  try {
    const fd = new FormData();
    fd.append('cv', file);
    const result = await apiUpload('/api/admin/contact/cv', fd);
    data.contact.cv = result.cv;
    data.contact.cvNom = result.cvNom;
    renderContactForm();
    toast('success', 'CV uploadé', file.name);
  } catch (err) {
    toast('error', 'Erreur upload', err.message);
  }
}

async function deleteCV() {
  if (!confirm('Supprimer le CV ?')) return;
  try {
    await apiJSON('/api/admin/contact/cv', 'DELETE');
    data.contact.cv = '';
    data.contact.cvNom = '';
    renderContactForm();
    toast('success', 'CV supprimé', '');
  } catch (err) {
    toast('error', 'Erreur', err.message);
  }
}

// ===== PERSONNALISATION SITE =====
function renderSiteForm() {
  const s = data.site || {};
  const val = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };

  val('site-navBrand', s.navBrand);
  val('site-metaTitle', s.metaTitle);

  const nav = s.nav || {};
  val('site-nav-presentation', nav.presentation);
  val('site-nav-projets', nav.projets);
  val('site-nav-tps', nav.tps);
  val('site-nav-competences', nav.competences);
  val('site-nav-veille', nav.veille);
  val('site-nav-contact', nav.contact);

  const sec = s.sections || {};
  val('site-sec-presentation', sec.presentation);
  val('site-sec-projets', sec.projets);
  val('site-sec-tps', sec.tps);
  val('site-sec-competences', sec.competences);
  val('site-sec-veille', sec.veille);
  val('site-sec-contact', sec.contact);

  val('site-presAbout', s.presAbout);
  const formation = s.formation || {};
  val('site-formation-specialite', formation.specialite);
  val('site-formation-annee', formation.annee);

  const t = s.terminal || {};
  val('site-t-fichier', t.fichier);
  val('site-t-cmd1', t.cmd1);
  val('site-t-cmd2', t.cmd2);
  val('site-t-rep2', t.rep2);
  val('site-t-cmd3', t.cmd3);
  val('site-t-rep3', t.rep3);

  const hero = s.hero || {};
  val('site-hero-btn1', hero.btn1);
  val('site-hero-btn2', hero.btn2);

  const cs = s.contactSection || {};
  val('site-contact-titre', cs.titre);
  val('site-contact-intro', cs.intro);
  val('site-contact-cvTitre', cs.cvTitre);
  val('site-contact-cvDesc', cs.cvDesc);

  val('site-footer', s.footer);
}

const getVal = (id) => document.getElementById(id)?.value || '';

async function saveSite() {
  try {
    const payload = {
      navBrand: getVal('site-navBrand'),
      metaTitle: getVal('site-metaTitle'),
      nav: {
        presentation: getVal('site-nav-presentation'),
        projets: getVal('site-nav-projets'),
        tps: getVal('site-nav-tps'),
        competences: getVal('site-nav-competences'),
        veille: getVal('site-nav-veille'),
        contact: getVal('site-nav-contact')
      },
      sections: {
        presentation: getVal('site-sec-presentation'),
        projets: getVal('site-sec-projets'),
        tps: getVal('site-sec-tps'),
        competences: getVal('site-sec-competences'),
        veille: getVal('site-sec-veille'),
        contact: getVal('site-sec-contact')
      },
      presAbout: getVal('site-presAbout'),
      formation: {
        specialite: getVal('site-formation-specialite'),
        annee: getVal('site-formation-annee')
      },
      terminal: {
        fichier: getVal('site-t-fichier'),
        cmd1: getVal('site-t-cmd1'),
        cmd2: getVal('site-t-cmd2'),
        rep2: getVal('site-t-rep2'),
        cmd3: getVal('site-t-cmd3'),
        rep3: getVal('site-t-rep3')
      },
      hero: {
        btn1: getVal('site-hero-btn1'),
        btn2: getVal('site-hero-btn2')
      },
      contactSection: {
        titre: getVal('site-contact-titre'),
        intro: getVal('site-contact-intro'),
        cvTitre: getVal('site-contact-cvTitre'),
        cvDesc: getVal('site-contact-cvDesc')
      },
      footer: getVal('site-footer')
    };
    const result = await apiJSON('/api/admin/site', 'PUT', payload);
    data.site = result;
    toast('success', 'Personnalisation sauvegardée', 'Toutes les modifications sont appliquées sur le site.');
  } catch (err) {
    toast('error', 'Erreur', err.message);
  }
}

// ===== MOT DE PASSE =====
async function changePassword() {
  const current = document.getElementById('pw-current').value;
  const newPw = document.getElementById('pw-new').value;
  const confirm = document.getElementById('pw-confirm').value;

  if (!current || !newPw || !confirm) { toast('error', 'Champs requis', 'Tous les champs sont obligatoires.'); return; }
  if (newPw !== confirm) { toast('error', 'Mots de passe différents', 'Le nouveau mot de passe et sa confirmation ne correspondent pas.'); return; }
  if (newPw.length < 6) { toast('error', 'Mot de passe trop court', 'Minimum 6 caractères.'); return; }

  try {
    await apiJSON('/api/admin/password', 'PUT', { currentPassword: current, newPassword: newPw });
    document.getElementById('pw-current').value = '';
    document.getElementById('pw-new').value = '';
    document.getElementById('pw-confirm').value = '';
    toast('success', 'Mot de passe modifié', 'Votre mot de passe a été mis à jour.');
  } catch (err) {
    toast('error', 'Erreur', err.message);
  }
}

// ===== LOGOUT =====
function logout() {
  localStorage.removeItem('admin_token');
  window.location.href = '/admin';
}

// ===== TOAST =====
function toast(type, title, msg) {
  const container = document.getElementById('toastContainer');
  const id = `toast-${Date.now()}`;
  const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.id = id;
  t.onclick = () => t.remove();
  t.innerHTML = `<i class="fa-solid ${icons[type] || 'fa-info'}"></i>
    <div class="toast-msg">
      <div class="toast-title">${title}</div>
      ${msg ? `<div class="toast-sub">${msg}</div>` : ''}
    </div>`;
  container.appendChild(t);
  setTimeout(() => t.remove(), 5000);
}

// ===== UTILS =====
function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
