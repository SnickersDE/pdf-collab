import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const fileInput = document.getElementById('fileInput');
const uploadBox = document.getElementById('uploadBox');
const pdfList = document.getElementById('pdfList');
const viewer = document.getElementById('viewer');
const viewerContent = document.getElementById('viewerContent');
const viewerClose = document.getElementById('viewerClose');
const downloadLink = document.getElementById('downloadLink');
const searchInput = document.getElementById('search');
const sortSelect = document.getElementById('sortBy');
const folderItems = document.querySelectorAll('#folders li');

let activeFolder = 'current';

// Ordnerauswahl
folderItems.forEach(li => {
  li.addEventListener('click', () => {
    folderItems.forEach(x => x.classList.remove('active'));
    li.classList.add('active');
    activeFolder = li.dataset.folder;
    fetchFiles();
  });
});

// Drag & Drop Upload
uploadBox.addEventListener('dragover', e => { e.preventDefault(); uploadBox.classList.add('drag'); });
uploadBox.addEventListener('dragleave', () => uploadBox.classList.remove('drag'));
uploadBox.addEventListener('drop', e => { e.preventDefault(); uploadBox.classList.remove('drag'); handleFiles(e.dataTransfer.files); });
fileInput.addEventListener('change', e => handleFiles(e.target.files));

async function handleFiles(fileList) {
  const arr = Array.from(fileList).filter(f => f.type === 'application/pdf');
  if (!arr.length) return alert('Nur PDF erlaubt');

  for (const file of arr) {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1];
      const timestamp = Date.now();
      const safeFileName = file.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-\.]/g, '');
      const fileName = `anon_${timestamp}_${safeFileName}`;

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName,
          fileContent: base64,
          folder: activeFolder
        })
      });

      const result = await res.json();
      if (!res.ok) {
        console.error("Upload Error:", result.error);
        alert('Upload fehlgeschlagen');
        return;
      }

      fetchFiles();
    };
    reader.readAsDataURL(file);
  }
}

// Dateien abrufen
async function fetchFiles() {
  pdfList.innerHTML = '<p>Lade Dateien...</p>';
  const { data, error } = await supabase.from('files').select('*').eq('folder', activeFolder).order('created_at', { ascending: false });
  if (error) { pdfList.innerHTML = '<p>Fehler beim Laden</p>'; console.error(error); return; }
  if (!data || !data.length) { pdfList.innerHTML = '<p class="muted">Keine Dateien</p>'; return; }
  renderFiles(data);
}

// Dateien rendern
function renderFiles(files) {
  const searchTerm = searchInput.value.toLowerCase();
  let filtered = files.filter(f => f.filename.toLowerCase().includes(searchTerm));

  const sortValue = sortSelect.value;
  filtered.sort((a, b) => {
    if (sortValue === 'date-desc') return new Date(b.created_at) - new Date(a.created_at);
    if (sortValue === 'date-asc') return new Date(a.created_at) - new Date(b.created_at);
    if (sortValue === 'name-asc') return a.filename.localeCompare(b.filename);
    if (sortValue === 'name-desc') return b.filename.localeCompare(a.filename);
  });

  pdfList.innerHTML = '';
  filtered.forEach(renderCard);
}

function renderCard(f) {
  const card = document.createElement('div'); card.className = 'pdf-card';
  const title = document.createElement('h3'); title.textContent = f.filename;
  const info = document.createElement('p'); info.textContent = `${(f.size / 1024 | 0)} KB • ${new Date(f.created_at).toLocaleString()}`;
  const btnOpen = document.createElement('button'); btnOpen.textContent = 'Öffnen'; btnOpen.onclick = () => openViewer(f);
  const btnDl = document.createElement('button'); btnDl.textContent = 'Download'; btnDl.onclick = () => downloadFile(f);
  const btnDelete = document.createElement('button'); btnDelete.textContent = 'Löschen'; btnDelete.onclick = () => deleteFile(f);
  card.append(title, info, btnOpen, btnDl, btnDelete);
  pdfList.append(card);
}

// Viewer öffnen
async function openViewer(f) {
  const { data, error } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(f.path, 3600);
  if (error) { console.error(error); alert('Fehler beim Laden'); return; }
  viewerContent.innerHTML = `<iframe src="${data.signedUrl}" style="width:100%;height:100%;border:0;"></iframe>`;
  downloadLink.href = data.signedUrl;
  downloadLink.setAttribute('download', f.filename);
  viewer.style.display = 'flex';
}
viewerClose.addEventListener('click', () => viewer.style.display = 'none');

// Download
async function downloadFile(f) {
  const { data, error } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(f.path, 3600);
  if (error) { console.error(error); alert('Fehler'); return; }
  window.open(data.signedUrl, '_blank');
}

// Löschen
async function deleteFile(f) {
  const confirmDelete = confirm(`"${f.filename}" wirklich löschen?`);
  if (!confirmDelete) return;

  const res = await fetch('/api/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: f.path })
  });

  const result = await res.json();
  if (!res.ok) {
    console.error('Delete Error:', result.error);
    alert('Löschen fehlgeschlagen');
    return;
  }

  fetchFiles(); // Refresh list
}

// Suche & Sort
searchInput.addEventListener('input', () => fetchFiles());
sortSelect.addEventListener('change', () => fetchFiles());

// Initial
fetchFiles();
