import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY, BUCKET_NAME } from './config.js';

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
let activeFolder = 'current';
let allFiles = [];

// Ordner wechseln
document.querySelectorAll('#folders li').forEach(li=>{
  li.addEventListener('click', ()=>{
    document.querySelectorAll('#folders li').forEach(x=>x.classList.remove('active'));
    li.classList.add('active');
    activeFolder = li.dataset.folder;
    renderFiles();
  });
});

// Drag & Drop Upload
uploadBox.addEventListener('dragover', e=>{ e.preventDefault(); uploadBox.classList.add('drag'); });
uploadBox.addEventListener('dragleave', ()=>uploadBox.classList.remove('drag'));
uploadBox.addEventListener('drop', e=>{ e.preventDefault(); uploadBox.classList.remove('drag'); handleFiles(e.dataTransfer.files); });
fileInput.addEventListener('change', e=> handleFiles(e.target.files));

async function handleFiles(fileList){
  const arr = Array.from(fileList).filter(f=>f.type==='application/pdf');
  if(arr.length===0) return alert('Nur PDFs erlaubt.');

  for(const file of arr){
    const timestamp = Date.now();
    const path = `${activeFolder}/anon_${timestamp}_${file.name}`;
    const { data, error } = await supabase.storage.from(BUCKET_NAME).upload(path, file, { cacheControl:'3600', upsert:false });
    if(error){ console.error(error); alert('Upload Fehler'); continue; }

    const { error: dbErr } = await supabase.from('files').insert([{ filename:file.name, path:data.path, size:file.size, folder:activeFolder, owner:'anon' }]);
    if(dbErr){ console.error(dbErr); alert('DB Fehler'); }
  }
  fetchFiles();
}

// Dateien laden
async function fetchFiles(){
  const { data, error } = await supabase.from('files').select('*').order('created_at', { ascending:false });
  if(error){ console.error(error); pdfList.innerHTML='<p>Fehler</p>'; return; }
  allFiles = data;
  renderFiles();
}

// Dateien rendern mit Filter & Sortierung
function renderFiles(){
  let files = allFiles.filter(f=>f.folder===activeFolder);

  const search = searchInput.value.toLowerCase();
  if(search) files = files.filter(f=>f.filename.toLowerCase().includes(search));

  const sort = sortSelect.value;
  if(sort==='date-desc') files.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  if(sort==='date-asc') files.sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
  if(sort==='name-asc') files.sort((a,b)=>a.filename.localeCompare(b.filename));
  if(sort==='name-desc') files.sort((a,b)=>b.filename.localeCompare(a.filename));

  pdfList.innerHTML = '';
  if(!files.length){ pdfList.innerHTML='<p class="muted">Keine Dateien</p>'; return; }
  files.forEach(f=>renderCard(f));
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

// Viewer
async function openViewer(f){
  const { data, error } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(f.path,3600);
  if(error){ console.error(error); alert('Fehler'); return; }
  viewerContent.innerHTML=`<iframe src="${data.signedUrl}" style="width:100%;height:100%;border:0;"></iframe>`;
  downloadLink.href=data.signedUrl;
  downloadLink.setAttribute('download', f.filename);
  viewer.style.display='block';
}
viewerClose.addEventListener('click', ()=>viewer.style.display='none');

// Download
async function downloadFile(f){
  const { data, error } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(f.path,3600);
  if(error){ console.error(error); alert('Fehler'); return; }
  window.open(data.signedUrl,'_blank');
}

// Live Search & Sort
searchInput.addEventListener('input', renderFiles);
sortSelect.addEventListener('change', renderFiles);

// Initial
fetchFiles();
// Supabase Realtime: automatisch Updates aus der 'files'-Tabelle empfangen
const subscription = supabase
  .channel('public:files')             // Kanal für die Tabelle 'files'
  .on('postgres_changes', { 
    event: '*',                         // insert, update, delete
    schema: 'public', 
    table: 'files'
  }, payload => {
    console.log('Realtime event:', payload);
    fetchFiles();                       // Liste neu laden
  })
  .subscribe();
