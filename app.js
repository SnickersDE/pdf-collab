// app.js
// Voraussetzung: config.js ist eingebunden (SUPABASE_URL, SUPABASE_ANON_KEY, BUCKET_NAME)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 1️⃣ Supabase Client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2️⃣ DOM-Referenzen
const fileInput = document.getElementById('fileInput');
const uploadBox = document.getElementById('uploadBox');
const pdfList = document.getElementById('pdfList');
const viewer = document.getElementById('viewer');
const viewerContent = document.getElementById('viewerContent');
const viewerClose = document.getElementById('viewerClose');
const downloadLink = document.getElementById('downloadLink');

let activeFolder = 'current'; // aktueller Ordner

// 3️⃣ Drag & Drop + Input Upload
uploadBox.addEventListener('dragover', e => { e.preventDefault(); uploadBox.classList.add('drag'); });
uploadBox.addEventListener('dragleave', e => uploadBox.classList.remove('drag'));
uploadBox.addEventListener('drop', e => { e.preventDefault(); uploadBox.classList.remove('drag'); handleFiles(e.dataTransfer.files); });
fileInput.addEventListener('change', e => handleFiles(e.target.files));

async function handleFiles(fileList) {
  const arr = Array.from(fileList).filter(f => f.type === 'application/pdf');
  if (!arr.length) return alert('Nur PDF-Dateien erlaubt.');

  for (const file of arr) {
    const timestamp = Date.now();
    const path = `${activeFolder}/${timestamp}_${file.name}`;

    // ✅ Upload in Supabase Storage (öffentlicher Bucket)
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from(BUCKET_NAME)
      .upload(path, file, { cacheControl: '3600', upsert: false });

    if (uploadError) { alert('Upload fehlgeschlagen: ' + uploadError.message); continue; }

    // 🔖 Metadaten in Tabelle 'files'
    const { error: insertError } = await supabase.from('files').insert([{
      filename: file.name,
      path: uploadData.path,
      size: file.size,
      folder: activeFolder
    }]);
    if (insertError) alert('DB Fehler: ' + insertError.message);
  }

  fetchAndRender();
}

// 4️⃣ Dateien abrufen & anzeigen
async function fetchAndRender() {
  pdfList.innerHTML = '<p>Lade Dateien...</p>';

  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('folder', activeFolder)
    .order('created_at', { ascending: false });

  if (error) { pdfList.innerHTML = '<p>Fehler beim Laden</p>'; console.error(error); return; }
  if (!data || !data.length) { pdfList.innerHTML = '<p class="muted">Keine Dateien</p>'; return; }

  pdfList.innerHTML = '';
  data.forEach(file => renderCard(file));
}

// 5️⃣ Karte rendern
function renderCard(f) {
  const card = document.createElement('div'); card.className = 'pdf-card';
  const title = document.createElement('h3'); title.textContent = f.filename;
  const info = document.createElement('p'); info.textContent = `${(f.size/1024|0)} KB • ${new Date(f.created_at).toLocaleString()}`;

  const btnOpen = document.createElement('button'); btnOpen.textContent = 'Öffnen';
  btnOpen.onclick = () => openViewer(f);

  const btnDl = document.createElement('button'); btnDl.textContent = 'Download';
  btnDl.onclick = () => downloadFile(f);

  card.append(title, info, btnOpen, btnDl);
  pdfList.append(card);
}

// 6️⃣ PDF Viewer öffnen (Public URL)
function openViewer(file) {
  // Public URL direkt
  const url = `https://${SUPABASE_URL.replace(/^https?:\/\//,'')}/storage/v1/object/public/${BUCKET_NAME}/${file.path}`;
  viewerContent.innerHTML = `<iframe src="${url}" style="width:100%;height:100%;border:0;"></iframe>`;
  downloadLink.href = url;
  downloadLink.setAttribute('download', file.filename);
  viewer.style.display = 'block';
}

viewerClose.addEventListener('click', () => viewer.style.display = 'none');

// 7️⃣ Download
function downloadFile(file) {
  const url = `https://${SUPABASE_URL.replace(/^https?:\/\//,'')}/storage/v1/object/public/${BUCKET_NAME}/${file.path}`;
  window.open(url, '_blank');
}

// 8️⃣ Ordner-Wechsel (optional)
document.querySelectorAll('#folders li').forEach(li => {
  li.addEventListener('click', () => {
    document.querySelectorAll('#folders li').forEach(x => x.classList.remove('active'));
    li.classList.add('active');
    activeFolder = li.dataset.folder;
    fetchAndRender();
  });
});

// 9️⃣ initial laden
fetchAndRender();
