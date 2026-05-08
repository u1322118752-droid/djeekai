require('dotenv').config();
const express = require('express');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const os = require('os');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) { console.error('❌ JWT_SECRET manquant dans .env'); process.exit(1); }
const MONGO_URI = process.env.MONGODB_URI;
if (!MONGO_URI) { console.error('❌ MONGODB_URI manquant dans .env'); process.exit(1); }

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB model
const Setting = mongoose.model('Setting', new mongoose.Schema({
  key: { type: String, unique: true, required: true },
  value: mongoose.Schema.Types.Mixed
}));

const defaults = {
  presentation: {
    nom: 'Prénom Nom',
    titre: 'Étudiant BTS CIO option SISR',
    description: 'Passionné par les infrastructures réseaux, la cybersécurité et les systèmes. En formation BTS CIO option SISR, je développe des compétences solides en administration système et réseaux.',
    photo: '',
    photoPublicId: '',
    localisation: 'Ville, France',
    ecole: 'Lycée / CFA'
  },
  projets: { items: [] },
  tps: { items: [] },
  competences: {
    categories: [
      {
        id: 1,
        nom: 'Réseaux',
        icone: 'fa-network-wired',
        competences: [
          { id: 1, nom: 'TCP/IP & Routage', niveau: 80 },
          { id: 2, nom: 'VLAN & Switching', niveau: 75 },
          { id: 3, nom: 'Cisco IOS', niveau: 70 }
        ]
      },
      {
        id: 2,
        nom: 'Systèmes',
        icone: 'fa-server',
        competences: [
          { id: 4, nom: 'Windows Server', niveau: 80 },
          { id: 5, nom: 'Linux (Debian/Ubuntu)', niveau: 75 },
          { id: 6, nom: 'Active Directory', niveau: 70 }
        ]
      },
      {
        id: 3,
        nom: 'Sécurité',
        icone: 'fa-shield-halved',
        competences: [
          { id: 7, nom: 'Pare-feu / Filtrage', niveau: 65 },
          { id: 8, nom: 'VPN', niveau: 70 },
          { id: 9, nom: 'Audit de sécurité', niveau: 55 }
        ]
      }
    ]
  },
  veille: { items: [] },
  contact: {
    email: 'email@example.com',
    telephone: '+33 6 00 00 00 00',
    linkedin: '',
    github: '',
    cv: '',
    cvNom: '',
    cvPublicId: ''
  },
  site: {
    metaTitle: 'Portfolio BTS CIO – SISR',
    navBrand: 'Portfolio',
    nav: {
      presentation: 'Présentation',
      projets: 'Projets',
      tps: 'TPs',
      competences: 'Compétences',
      veille: 'Veille',
      contact: 'Contact'
    },
    sections: {
      presentation: 'Présentation',
      projets: 'Projets',
      tps: 'Travaux Pratiques',
      competences: 'Compétences',
      veille: 'Veille Technologique',
      contact: 'CV & Contact'
    },
    presAbout: 'À propos de moi',
    formation: {
      specialite: 'Option SISR',
      annee: '2024 – 2026'
    },
    terminal: {
      fichier: 'whoami.sh',
      cmd1: 'whoami',
      cmd2: 'cat formation.txt',
      rep2: 'BTS CIO option SISR',
      cmd3: 'cat objectif.txt',
      rep3: 'Administrateur Système & Réseaux'
    },
    hero: {
      btn1: 'Voir mes projets',
      btn2: 'Me contacter'
    },
    contactSection: {
      titre: 'Restons en contact',
      intro: "N'hésitez pas à me contacter pour toute opportunité de stage, alternance ou simplement pour échanger.",
      cvTitre: 'Mon Curriculum Vitæ',
      cvDesc: 'Téléchargez mon CV pour en savoir plus sur mon parcours et mes compétences.'
    },
    footer: 'Portfolio BTS CIO option SISR'
  }
};

const genId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// Helpers
const readData = async (key) => {
  const doc = await Setting.findOne({ key });
  return doc ? doc.value : defaults[key];
};

const writeData = async (key, value) => {
  await Setting.findOneAndUpdate({ key }, { value }, { upsert: true, returnDocument: 'after' });
};

const deleteCloudinaryFile = async (publicId, resourceType = 'image') => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (e) {
    console.error('Cloudinary delete error:', e.message);
  }
};

// Multer + Cloudinary storages
const mkImageUpload = (folder) => multer({
  storage: new CloudinaryStorage({
    cloudinary,
    params: { folder: `portfolio/${folder}`, allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }
  }),
  fileFilter: (_, file, cb) => ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype) ? cb(null, true) : cb(new Error('Type non accepté')),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// PDF upload via mémoire + stream manuel vers Cloudinary (plus fiable que multer-storage-cloudinary pour les raw)
const pdfMemory = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_, file, cb) => file.mimetype === 'application/pdf' ? cb(null, true) : cb(new Error('Seuls les fichiers PDF sont acceptés')),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const uploadPDFToCloudinary = async (buffer, folder, originalname) => {
  const publicId = `portfolio/${folder}/${Date.now()}_${originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const tmpPath = path.join(os.tmpdir(), `pdf_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`);
  fs.writeFileSync(tmpPath, buffer);
  try {
    const result = await cloudinary.uploader.upload(tmpPath, { resource_type: 'raw', type: 'upload', public_id: publicId });
    console.log(`PDF uploaded: public_id=${result.public_id} bytes=${result.bytes}`);
    return result;
  } finally {
    fs.unlink(tmpPath, () => {});
  }
};

const upPDF = pdfMemory.single('pdf');
const upTPDF = pdfMemory.single('pdf');
const upCVPDF = pdfMemory.single('cv');
const upPhoto = mkImageUpload('presentation');
const upVeille = mkImageUpload('veille');

// Multer error wrapper — retourne une réponse JSON au lieu de HTML
const upload = (middleware) => (req, res, next) => {
  middleware(req, res, (err) => {
    if (err) {
      console.error('UPLOAD ERROR:', err);
      return res.status(400).json({ error: err.message || 'Erreur upload' });
    }
    next();
  });
};

// Auth middleware
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Non autorisé' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré' });
  }
};

// ===== PDF PROXY =====

app.get('/api/pdf', (req, res) => {
  let { url, filename, mode } = req.query;
  if (!url) return res.status(400).send('URL manquante');
  try { url = decodeURIComponent(url); } catch { return res.status(400).send('URL invalide'); }
  if (!url.startsWith('https://res.cloudinary.com/')) return res.status(403).send('URL non autorisée');

  const m = url.match(/\/raw\/upload\/(?:v\d+\/)?(.+)$/);
  if (!m) return res.status(400).send('URL Cloudinary invalide');
  const publicId = m[1];

  let signedUrl;
  try {
    signedUrl = cloudinary.url(publicId, { resource_type: 'raw', sign_url: true, secure: true });
  } catch (e) {
    console.error('PDF sign error:', e);
    return res.status(500).send('Erreur signature URL');
  }

  if (mode === 'view') {
    return res.redirect(302, signedUrl);
  }

  let name = filename ? decodeURIComponent(filename) : 'document.pdf';
  if (!name.toLowerCase().endsWith('.pdf')) name += '.pdf';
  const safe = name.replace(/[^\w.\- ]/g, '_');

  require('https').get(signedUrl, (upstream) => {
    console.log(`PDF download: status=${upstream.statusCode} publicId=${publicId}`);
    if (upstream.statusCode !== 200) {
      upstream.resume();
      return res.status(404).send(`Fichier introuvable (${upstream.statusCode})`);
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safe}"`);
    upstream.pipe(res);
  }).on('error', (err) => {
    console.error('PDF download error:', err);
    if (!res.headersSent) res.status(500).send('Erreur téléchargement');
  });
});

// ===== PUBLIC API =====

app.get('/api/data', async (req, res) => {
  try {
    const [presentation, projets, tps, competences, veille, contact, site] = await Promise.all([
      readData('presentation'),
      readData('projets'),
      readData('tps'),
      readData('competences'),
      readData('veille'),
      readData('contact'),
      readData('site')
    ]);
    res.json({ presentation, projets, tps, competences, veille, contact, site });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== AUTH =====

app.post('/api/admin/login', async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Mot de passe requis' });
  const config = await readData('config');
  const hash = config?.password || bcrypt.hashSync('admin123', 10);
  const valid = await bcrypt.compare(password, hash);
  if (!valid) return res.status(401).json({ error: 'Mot de passe incorrect' });
  const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token });
});

app.get('/api/admin/verify', auth, (req, res) => res.json({ valid: true }));

// ===== ADMIN: PRÉSENTATION =====

app.put('/api/admin/presentation', auth, async (req, res) => {
  const data = { ...await readData('presentation'), ...req.body };
  await writeData('presentation', data);
  res.json(data);
});

app.post('/api/admin/presentation/photo', auth, upload(upPhoto.single('photo')), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });
  const data = await readData('presentation');
  await deleteCloudinaryFile(data.photoPublicId, 'image');
  data.photo = req.file.path;
  data.photoPublicId = req.file.filename;
  await writeData('presentation', data);
  res.json({ photo: data.photo });
});

// ===== ADMIN: PROJETS =====

app.post('/api/admin/projets', auth, async (req, res) => {
  const data = await readData('projets');
  const item = { id: genId(), titre: '', description: '', technologies: [], pdf: '', pdfNom: '', pdfPublicId: '', date: new Date().toISOString().split('T')[0], ...req.body };
  data.items.push(item);
  await writeData('projets', data);
  res.json(item);
});

app.put('/api/admin/projets/:id', auth, async (req, res) => {
  const data = await readData('projets');
  const idx = data.items.findIndex(p => p.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Projet non trouvé' });
  data.items[idx] = { ...data.items[idx], ...req.body };
  await writeData('projets', data);
  res.json(data.items[idx]);
});

app.delete('/api/admin/projets/:id', auth, async (req, res) => {
  const data = await readData('projets');
  const idx = data.items.findIndex(p => p.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Projet non trouvé' });
  await deleteCloudinaryFile(data.items[idx].pdfPublicId, 'raw');
  data.items.splice(idx, 1);
  await writeData('projets', data);
  res.json({ success: true });
});

app.post('/api/admin/projets/:id/pdf', auth, upPDF, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });
    const data = await readData('projets');
    const idx = data.items.findIndex(p => p.id == req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Projet non trouvé' });
    await deleteCloudinaryFile(data.items[idx].pdfPublicId, 'raw');
    const result = await uploadPDFToCloudinary(req.file.buffer, 'projets', req.file.originalname);
    data.items[idx].pdf = result.secure_url;
    data.items[idx].pdfNom = req.file.originalname;
    data.items[idx].pdfPublicId = result.public_id;
    await writeData('projets', data);
    res.json({ pdf: data.items[idx].pdf, pdfNom: data.items[idx].pdfNom });
  } catch (err) {
    console.error('PDF upload error:', err);
    res.status(500).json({ error: err.message || 'Erreur upload PDF' });
  }
});

app.delete('/api/admin/projets/:id/pdf', auth, async (req, res) => {
  const data = await readData('projets');
  const idx = data.items.findIndex(p => p.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Projet non trouvé' });
  await deleteCloudinaryFile(data.items[idx].pdfPublicId, 'raw');
  data.items[idx].pdf = '';
  data.items[idx].pdfNom = '';
  data.items[idx].pdfPublicId = '';
  await writeData('projets', data);
  res.json({ success: true });
});

// ===== ADMIN: TPs =====

app.post('/api/admin/tps', auth, async (req, res) => {
  const data = await readData('tps');
  const item = { id: genId(), titre: '', description: '', objectif: '', pdf: '', pdfNom: '', pdfPublicId: '', date: new Date().toISOString().split('T')[0], ...req.body };
  data.items.push(item);
  await writeData('tps', data);
  res.json(item);
});

app.put('/api/admin/tps/:id', auth, async (req, res) => {
  const data = await readData('tps');
  const idx = data.items.findIndex(p => p.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'TP non trouvé' });
  data.items[idx] = { ...data.items[idx], ...req.body };
  await writeData('tps', data);
  res.json(data.items[idx]);
});

app.delete('/api/admin/tps/:id', auth, async (req, res) => {
  const data = await readData('tps');
  const idx = data.items.findIndex(p => p.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'TP non trouvé' });
  await deleteCloudinaryFile(data.items[idx].pdfPublicId, 'raw');
  data.items.splice(idx, 1);
  await writeData('tps', data);
  res.json({ success: true });
});

app.post('/api/admin/tps/:id/pdf', auth, upTPDF, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });
    const data = await readData('tps');
    const idx = data.items.findIndex(p => p.id == req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'TP non trouvé' });
    await deleteCloudinaryFile(data.items[idx].pdfPublicId, 'raw');
    const result = await uploadPDFToCloudinary(req.file.buffer, 'tps', req.file.originalname);
    data.items[idx].pdf = result.secure_url;
    data.items[idx].pdfNom = req.file.originalname;
    data.items[idx].pdfPublicId = result.public_id;
    await writeData('tps', data);
    res.json({ pdf: data.items[idx].pdf, pdfNom: data.items[idx].pdfNom });
  } catch (err) {
    console.error('PDF upload error:', err);
    res.status(500).json({ error: err.message || 'Erreur upload PDF' });
  }
});

app.delete('/api/admin/tps/:id/pdf', auth, async (req, res) => {
  const data = await readData('tps');
  const idx = data.items.findIndex(p => p.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'TP non trouvé' });
  await deleteCloudinaryFile(data.items[idx].pdfPublicId, 'raw');
  data.items[idx].pdf = '';
  data.items[idx].pdfNom = '';
  data.items[idx].pdfPublicId = '';
  await writeData('tps', data);
  res.json({ success: true });
});

// ===== ADMIN: COMPÉTENCES =====

app.put('/api/admin/competences', auth, async (req, res) => {
  await writeData('competences', req.body);
  res.json(req.body);
});

// ===== ADMIN: VEILLE =====

app.post('/api/admin/veille', auth, async (req, res) => {
  const data = await readData('veille');
  const item = { id: genId(), titre: '', resume: '', source: '', lien: '', image: '', imagePublicId: '', date: new Date().toISOString().split('T')[0], ...req.body };
  data.items.push(item);
  await writeData('veille', data);
  res.json(item);
});

app.put('/api/admin/veille/:id', auth, async (req, res) => {
  const data = await readData('veille');
  const idx = data.items.findIndex(v => v.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Article non trouvé' });
  data.items[idx] = { ...data.items[idx], ...req.body };
  await writeData('veille', data);
  res.json(data.items[idx]);
});

app.delete('/api/admin/veille/:id', auth, async (req, res) => {
  const data = await readData('veille');
  const idx = data.items.findIndex(v => v.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Article non trouvé' });
  await deleteCloudinaryFile(data.items[idx].imagePublicId, 'image');
  data.items.splice(idx, 1);
  await writeData('veille', data);
  res.json({ success: true });
});

app.post('/api/admin/veille/:id/image', auth, upload(upVeille.single('image')), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });
  const data = await readData('veille');
  const idx = data.items.findIndex(v => v.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Article non trouvé' });
  await deleteCloudinaryFile(data.items[idx].imagePublicId, 'image');
  data.items[idx].image = req.file.path;
  data.items[idx].imagePublicId = req.file.filename;
  await writeData('veille', data);
  res.json({ image: data.items[idx].image });
});

// ===== ADMIN: CONTACT =====

app.put('/api/admin/contact', auth, async (req, res) => {
  const data = { ...await readData('contact'), ...req.body };
  await writeData('contact', data);
  res.json(data);
});

app.post('/api/admin/contact/cv', auth, upCVPDF, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });
    const data = await readData('contact');
    await deleteCloudinaryFile(data.cvPublicId, 'raw');
    const result = await uploadPDFToCloudinary(req.file.buffer, 'cv', req.file.originalname);
    data.cv = result.secure_url;
    data.cvNom = req.file.originalname;
    data.cvPublicId = result.public_id;
    await writeData('contact', data);
    res.json({ cv: data.cv, cvNom: data.cvNom });
  } catch (err) {
    console.error('CV upload error:', err);
    res.status(500).json({ error: err.message || 'Erreur upload CV' });
  }
});

app.delete('/api/admin/contact/cv', auth, async (req, res) => {
  const data = await readData('contact');
  await deleteCloudinaryFile(data.cvPublicId, 'raw');
  data.cv = '';
  data.cvNom = '';
  data.cvPublicId = '';
  await writeData('contact', data);
  res.json({ success: true });
});

// ===== ADMIN: SITE =====

app.put('/api/admin/site', auth, async (req, res) => {
  const current = await readData('site');
  const updated = mergeDeep(current, req.body);
  await writeData('site', updated);
  res.json(updated);
});

function mergeDeep(target, source) {
  const out = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      out[key] = mergeDeep(target[key] || {}, source[key]);
    } else {
      out[key] = source[key];
    }
  }
  return out;
}

// ===== ADMIN: MOT DE PASSE =====

app.put('/api/admin/password', auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Champs manquants' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caractères' });
  const config = await readData('config');
  const hash = config?.password || bcrypt.hashSync('admin123', 10);
  const valid = await bcrypt.compare(currentPassword, hash);
  if (!valid) return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
  const newHash = await bcrypt.hash(newPassword, 10);
  await writeData('config', { password: newHash });
  res.json({ success: true });
});

// ===== SERVE ADMIN PAGES =====

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public/admin/index.html')));
app.get('/admin/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public/admin/dashboard.html')));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(500).json({ error: err.message });
});

// Start server after DB connection
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ Connecté à MongoDB Atlas');
    app.listen(PORT, () => {
      console.log(`\n🚀 Portfolio démarré sur http://localhost:${PORT}`);
      console.log(`🔐 Panel admin: http://localhost:${PORT}/admin`);
      console.log(`📋 Mot de passe par défaut: admin123\n`);
    });
  })
  .catch(err => {
    console.error('❌ Erreur connexion MongoDB:', err.message);
    process.exit(1);
  });
