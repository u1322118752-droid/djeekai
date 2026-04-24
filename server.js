const express = require('express');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'portfolio-bts-sisr-secret-2024';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Create required directories
['data', 'uploads/projets', 'uploads/tps', 'uploads/cv', 'uploads/presentation', 'uploads/veille'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Initialize default data files
const defaults = {
  presentation: {
    nom: 'Prénom Nom',
    titre: 'Étudiant BTS CIO option SISR',
    description: 'Passionné par les infrastructures réseaux, la cybersécurité et les systèmes. En formation BTS CIO option SISR, je développe des compétences solides en administration système et réseaux.',
    photo: '',
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
    cvNom: ''
  }
};

Object.entries(defaults).forEach(([key, value]) => {
  const file = `data/${key}.json`;
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(value, null, 2));
});

// Initialize admin config with hashed default password "admin123"
if (!fs.existsSync('data/config.json')) {
  const hash = bcrypt.hashSync('admin123', 10);
  fs.writeFileSync('data/config.json', JSON.stringify({ password: hash }, null, 2));
}

// Helpers
const readData = (file) => JSON.parse(fs.readFileSync(`data/${file}.json`, 'utf8'));
const writeData = (file, data) => fs.writeFileSync(`data/${file}.json`, JSON.stringify(data, null, 2));
const deleteFile = (filePath) => { if (filePath && fs.existsSync(`.${filePath}`)) fs.unlinkSync(`.${filePath}`); };

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

// Multer factory
const mkUpload = (folder, types) => multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, `uploads/${folder}`),
    filename: (_, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`)
  }),
  fileFilter: (_, file, cb) => types.includes(file.mimetype) ? cb(null, true) : cb(new Error('Type de fichier non accepté')),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const upPDF = mkUpload('projets', ['application/pdf']);
const upTPDF = mkUpload('tps', ['application/pdf']);
const upCVPDF = mkUpload('cv', ['application/pdf']);
const upPhoto = mkUpload('presentation', ['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const upVeille = mkUpload('veille', ['image/jpeg', 'image/png', 'image/webp']);

// ===== PUBLIC API =====

app.get('/api/data', (req, res) => {
  try {
    res.json({
      presentation: readData('presentation'),
      projets: readData('projets'),
      tps: readData('tps'),
      competences: readData('competences'),
      veille: readData('veille'),
      contact: readData('contact')
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== AUTH =====

app.post('/api/admin/login', async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Mot de passe requis' });
  const config = readData('config');
  const valid = await bcrypt.compare(password, config.password);
  if (!valid) return res.status(401).json({ error: 'Mot de passe incorrect' });
  const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token });
});

app.get('/api/admin/verify', auth, (req, res) => res.json({ valid: true }));

// ===== ADMIN: PRÉSENTATION =====

app.put('/api/admin/presentation', auth, (req, res) => {
  const data = { ...readData('presentation'), ...req.body };
  writeData('presentation', data);
  res.json(data);
});

app.post('/api/admin/presentation/photo', auth, upPhoto.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });
  const data = readData('presentation');
  deleteFile(data.photo);
  data.photo = `/uploads/presentation/${req.file.filename}`;
  writeData('presentation', data);
  res.json({ photo: data.photo });
});

// ===== ADMIN: PROJETS =====

app.post('/api/admin/projets', auth, (req, res) => {
  const data = readData('projets');
  const item = { id: Date.now(), titre: '', description: '', technologies: [], pdf: '', pdfNom: '', date: new Date().toISOString().split('T')[0], ...req.body };
  data.items.push(item);
  writeData('projets', data);
  res.json(item);
});

app.put('/api/admin/projets/:id', auth, (req, res) => {
  const data = readData('projets');
  const idx = data.items.findIndex(p => p.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Projet non trouvé' });
  data.items[idx] = { ...data.items[idx], ...req.body };
  writeData('projets', data);
  res.json(data.items[idx]);
});

app.delete('/api/admin/projets/:id', auth, (req, res) => {
  const data = readData('projets');
  const idx = data.items.findIndex(p => p.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Projet non trouvé' });
  deleteFile(data.items[idx].pdf);
  data.items.splice(idx, 1);
  writeData('projets', data);
  res.json({ success: true });
});

app.post('/api/admin/projets/:id/pdf', auth, upPDF.single('pdf'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });
  const data = readData('projets');
  const idx = data.items.findIndex(p => p.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Projet non trouvé' });
  deleteFile(data.items[idx].pdf);
  data.items[idx].pdf = `/uploads/projets/${req.file.filename}`;
  data.items[idx].pdfNom = req.file.originalname;
  writeData('projets', data);
  res.json({ pdf: data.items[idx].pdf, pdfNom: data.items[idx].pdfNom });
});

app.delete('/api/admin/projets/:id/pdf', auth, (req, res) => {
  const data = readData('projets');
  const idx = data.items.findIndex(p => p.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Projet non trouvé' });
  deleteFile(data.items[idx].pdf);
  data.items[idx].pdf = '';
  data.items[idx].pdfNom = '';
  writeData('projets', data);
  res.json({ success: true });
});

// ===== ADMIN: TPs =====

app.post('/api/admin/tps', auth, (req, res) => {
  const data = readData('tps');
  const item = { id: Date.now(), titre: '', description: '', objectif: '', pdf: '', pdfNom: '', date: new Date().toISOString().split('T')[0], ...req.body };
  data.items.push(item);
  writeData('tps', data);
  res.json(item);
});

app.put('/api/admin/tps/:id', auth, (req, res) => {
  const data = readData('tps');
  const idx = data.items.findIndex(p => p.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'TP non trouvé' });
  data.items[idx] = { ...data.items[idx], ...req.body };
  writeData('tps', data);
  res.json(data.items[idx]);
});

app.delete('/api/admin/tps/:id', auth, (req, res) => {
  const data = readData('tps');
  const idx = data.items.findIndex(p => p.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'TP non trouvé' });
  deleteFile(data.items[idx].pdf);
  data.items.splice(idx, 1);
  writeData('tps', data);
  res.json({ success: true });
});

app.post('/api/admin/tps/:id/pdf', auth, upTPDF.single('pdf'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });
  const data = readData('tps');
  const idx = data.items.findIndex(p => p.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'TP non trouvé' });
  deleteFile(data.items[idx].pdf);
  data.items[idx].pdf = `/uploads/tps/${req.file.filename}`;
  data.items[idx].pdfNom = req.file.originalname;
  writeData('tps', data);
  res.json({ pdf: data.items[idx].pdf, pdfNom: data.items[idx].pdfNom });
});

app.delete('/api/admin/tps/:id/pdf', auth, (req, res) => {
  const data = readData('tps');
  const idx = data.items.findIndex(p => p.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'TP non trouvé' });
  deleteFile(data.items[idx].pdf);
  data.items[idx].pdf = '';
  data.items[idx].pdfNom = '';
  writeData('tps', data);
  res.json({ success: true });
});

// ===== ADMIN: COMPÉTENCES =====

app.put('/api/admin/competences', auth, (req, res) => {
  writeData('competences', req.body);
  res.json(req.body);
});

// ===== ADMIN: VEILLE =====

app.post('/api/admin/veille', auth, (req, res) => {
  const data = readData('veille');
  const item = { id: Date.now(), titre: '', resume: '', source: '', lien: '', image: '', date: new Date().toISOString().split('T')[0], ...req.body };
  data.items.push(item);
  writeData('veille', data);
  res.json(item);
});

app.put('/api/admin/veille/:id', auth, (req, res) => {
  const data = readData('veille');
  const idx = data.items.findIndex(v => v.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Article non trouvé' });
  data.items[idx] = { ...data.items[idx], ...req.body };
  writeData('veille', data);
  res.json(data.items[idx]);
});

app.delete('/api/admin/veille/:id', auth, (req, res) => {
  const data = readData('veille');
  const idx = data.items.findIndex(v => v.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Article non trouvé' });
  deleteFile(data.items[idx].image);
  data.items.splice(idx, 1);
  writeData('veille', data);
  res.json({ success: true });
});

app.post('/api/admin/veille/:id/image', auth, upVeille.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });
  const data = readData('veille');
  const idx = data.items.findIndex(v => v.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Article non trouvé' });
  deleteFile(data.items[idx].image);
  data.items[idx].image = `/uploads/veille/${req.file.filename}`;
  writeData('veille', data);
  res.json({ image: data.items[idx].image });
});

// ===== ADMIN: CONTACT =====

app.put('/api/admin/contact', auth, (req, res) => {
  const data = { ...readData('contact'), ...req.body };
  writeData('contact', data);
  res.json(data);
});

app.post('/api/admin/contact/cv', auth, upCVPDF.single('cv'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });
  const data = readData('contact');
  deleteFile(data.cv);
  data.cv = `/uploads/cv/${req.file.filename}`;
  data.cvNom = req.file.originalname;
  writeData('contact', data);
  res.json({ cv: data.cv, cvNom: data.cvNom });
});

app.delete('/api/admin/contact/cv', auth, (req, res) => {
  const data = readData('contact');
  deleteFile(data.cv);
  data.cv = '';
  data.cvNom = '';
  writeData('contact', data);
  res.json({ success: true });
});

// ===== ADMIN: MOT DE PASSE =====

app.put('/api/admin/password', auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Champs manquants' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caractères' });
  const config = readData('config');
  const valid = await bcrypt.compare(currentPassword, config.password);
  if (!valid) return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
  config.password = await bcrypt.hash(newPassword, 10);
  writeData('config', config);
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

app.listen(PORT, () => {
  console.log(`\n🚀 Portfolio démarré sur http://localhost:${PORT}`);
  console.log(`🔐 Panel admin: http://localhost:${PORT}/admin`);
  console.log(`📋 Mot de passe par défaut: admin123\n`);
});
