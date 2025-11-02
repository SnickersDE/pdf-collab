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
folderItems.forEach(li=>{
  li.addEventListener('click', ()=>{
    folderItems.forEach(x=>x.classList.remove('active'));
    li.classList.add('active');
    activeFolder = li.dataset.folder;
    fetchFiles();
  });
});

// Drag & Drop Upload
uploadBox.addEventListener('dragover', e=>{ e.preventDefault(); uploadBox.classList.add('drag'); });
uploadBox.addEventListener('dragleave', ()=>uploadBox.classList.remove('drag'));
uploadBox.addEventListener('drop', e=>{ e.preventDefault(); uploadBox.classList.remove('drag'); handleFiles(e.dataTransfer.files); });
fileInput.addEventListener('change', e=>handleFiles(e.target.files));

// Upload-Funktion
async function handleFiles(fileList){
  const arr = Array.from(fileList).filter(f=>f.type==='application/pdf');
  if(!arr.length) return alert('Nur PDF erlaubt');

  for(const file of arr){
    const timestamp = Date.now();
    const safeFileName = file.name.replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_\-\.]/g,'');
    const path = `${activeFolder}/anon_${timestamp}_${safeFileName}`;

    // Storage Upload
    const { data: uploadData, error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(path, file, { cacheControl:'3600', upsert:false });
    if(uploadError){ console.error("Storage Error:",uploadError); alert('Upload fehlgeschlagen'); continue; }

    // DB Eintrag
    const { error: insertError } = await supabase.from('files').insert([{
      filename:file.name,
      path:uploadData.path,
      size:file.size,
      folder:activeFolder,
      owner:null
    }]);
    if(insertError){ console.error("DB Insert Error:",insertError); alert('Upload fehlgeschlagen'); continue; }
  }

  fetchFiles();
}

// Dateien abrufen
async function fetchFiles(){
  pdfList.innerHTML='<p>Lade Dateien...</p>';
  const { data, error } = await supabase.from('files').select('*').eq('folder',activeFolder).order('created_at',{ascending:false});
  if(error){ pdfList.innerHTML='<p>Fehler beim Laden</p>'; console.error(error); return; }
  if(!data || !data.length){ pdfList.innerHTML='<p class="muted">Keine Dateien</p>'; return; }
  renderFiles(data);
}

// Dateien rendern
function renderFiles(files){
  const searchTerm = searchInput.value.toLowerCase();
  let filtered = files.filter(f=>f.filename.toLowerCase().includes(searchTerm));

  const sortValue = sortSelect.value;
  filtered.sort((a,b)=>{
    if(sortValue==='date-desc') return new Date(b.created_at)-new Date(a.created_at);
    if(sortValue==='date-asc') return new Date(a.created_at)-new Date(b.created_at);
    if(sortValue==='name-asc') return a.filename.localeCompare(b.filename);
    if(sortValue==='name-desc') return b.filename.localeCompare(a.filename);
  });

  pdfList.innerHTML='';
  filtered.forEach(renderCard);
}

function renderCard(f){
  const card = document.createElement('div'); card.className='pdf-card';
  const title = document.createElement('h3'); title.textContent=f.filename;
  const info = document.createElement('p'); info.textContent=`${(f.size/1024|0)} KB • ${new Date(f.created_at).toLocaleString()}`;
  const btnOpen = document.createElement('button'); btnOpen.textContent='Öffnen'; btnOpen.onclick=()=>openViewer(f);
  const btnDl = document.createElement('button'); btnDl.textContent='Download'; btnDl.onclick=()=>downloadFile(f);
  card.append(title, info, btnOpen, btnDl);
  pdfList.append(card);
}

// Viewer öffnen
async function openViewer(f){
  const { data, error } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(f.path,3600);
  if(error){ console.error(error); alert('Fehler beim Laden'); return; }
  viewerContent.innerHTML=`<iframe src="${data.signedUrl}" style="width:100%;height:100%;border:0;"></iframe>`;
  downloadLink.href=data.signedUrl;
  downloadLink.setAttribute('download', f.filename);
  viewer.style.display='flex';
}
viewerClose.addEventListener('click', ()=>viewer.style.display='none');

// Download
async function downloadFile(f){
  const { data, error } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(f.path,3600);
  if(error){ console.error(error); alert('Fehler'); return; }
  window.open(data.signedUrl,'_blank');
}

// Suche & Sort
searchInput.addEventListener('input',()=>fetchFiles());
sortSelect.addEventListener('change',()=>fetchFiles());

// Initial
fetchFiles();

