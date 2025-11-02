// app.js
// Voraussetzung: config.js ist eingebunden (enthält SUPABASE_URL & SUPABASE_ANON_KEY)

// 1️⃣ Supabase Client initialisieren (korrekte Syntax)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2️⃣ DOM-Referenzen (wie gehabt)
const fileInput = document.getElementById('fileInput');
const uploadBox = document.getElementById('uploadBox');
const pdfList = document.getElementById('pdfList');
const viewer = document.getElementById('viewer');
const viewerContent = document.getElementById('viewerContent');
const viewerClose = document.getElementById('viewerClose');
const downloadLink = document.getElementById('downloadLink');
const btnSignIn = document.getElementById('btnSignIn');
const btnSignOut = document.getElementById('btnSignOut');

let activeFolder = 'current';
let currentUser = null;

// 3️⃣ Auth-State überwachen
supabase.auth.onAuthStateChange((event, session) => {
  currentUser = session?.user ?? null;
  updateAuthUI();
  fetchAndRender();
});

function updateAuthUI() {
  btnSignIn.style.display = currentUser ? 'none' : '';
  btnSignOut.style.display = currentUser ? '' : 'none';
}

// 4️⃣ Magic Link Auth
btnSignIn.addEventListener('click', async ()=>{
  const email = prompt('E-Mail für Magic Link:');
  if(!email) return;
  const { error } = await supabase.auth.signInWithOtp({ email });
  if(error) alert('Fehler: '+error.message);
  else alert('Magic Link gesendet.');
});

btnSignOut.addEventListener('click', async ()=>{
  await supabase.auth.signOut();
  currentUser = null;
  updateAuthUI();
  fetchAndRender();
});

// 5️⃣ Drag & Drop + Input Upload
uploadBox.addEventListener('dragover', e=>{
  e.preventDefault();
  uploadBox.classList.add('drag');
});
uploadBox.addEventListener('dragleave', ()=> uploadBox.classList.remove('drag'));
uploadBox.addEventListener('drop', e=>{
  e.preventDefault();
  uploadBox.classList.remove('drag');
  handleFiles(e.dataTransfer.files);
});
fileInput.addEventListener('change', e=> handleFiles(e.target.files));

async function handleFiles(fileList){
  const arr = Array.from(fileList).filter(f => f.type === 'application/pdf');
  if(arr.length === 0) return alert('Nur PDF-Dateien erlaubt.');

  for(const file of arr){
    const timestamp = Date.now();
    const userSegment = currentUser ? currentUser.id.slice(0,8) : 'anon';
    const path = `${activeFolder}/${userSegment}_${timestamp}_${file.name}`;

    // ⬆️ Upload in Supabase Storage (dein Bucket)
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from(pdf-collab) // <-- MUSS mit config.js übereinstimmen
      .upload(path, file, { cacheControl: '3600', upsert: false });

    if(uploadError){
      alert('Upload fehlgeschlagen: ' + uploadError.message);
      continue;
    }

    // 🔖 Metadaten in DB speichern
    const owner = currentUser ? currentUser.id : null;
    const { error: insertError } = await supabase.from('files').insert([{
      filename: file.name,
      path: uploadData.path,
      size: file.size,
      folder: activeFolder,
      owner
    }]);
    if(insertError) alert('DB Fehler: ' + insertError.message);
  }

  fetchAndRender();
}

// 6️⃣ Dateien abrufen
async function fetchAndRender(){
  pdfList.innerHTML = '<p>Lade Dateien...</p>';
  let query = supabase.from('files').select('*').eq('folder', activeFolder).order('created_at', { ascending: false });
  if(currentUser) query = query.eq('owner', currentUser.id);

  const { data, error } = await query;
  if(error) return pdfList.innerHTML = '<p>Fehler beim Laden</p>';
  if(!data || !data.length) return pdfList.innerHTML = '<p class="muted">Keine Dateien</p>';

  pdfList.innerHTML = '';
  data.forEach(file => renderCard(file));
}

// 7️⃣ Karte rendern
function renderCard(f){
  const card = document.createElement('div'); card.className='pdf-card';
  const title = document.createElement('h3'); title.textContent = f.filename;
  const info = document.createElement('p'); info.textContent = `${(f.size/1024|0)} KB • ${new Date(f.created_at).toLocaleString()}`;
  const btnOpen = document.createElement('button'); btnOpen.textContent='Öffnen'; btnOpen.onclick = ()=> openViewer(f);
  const btnDl = document.createElement('button'); btnDl.textContent='Download'; btnDl.onclick = ()=> downloadFile(f);
  card.append(title, info, btnOpen, btnDl);
  pdfList.append(card);
}

// 8️⃣ SIGNED URL erzeugen & PDF Viewer öffnen
async function openViewer(file){
  const { data, error } = await supabase.storage
    .from(pdf-collab)
    .createSignedUrl(file.path, 3600); // 1 Stunde gültig

  if(error) return alert('Fehler beim Laden: ' + error.message);
  const url = data.signedUrl; // korrekter Key (⚠️ kleine Schreibweise)
  viewerContent.innerHTML = `<iframe src="${url}" style="width:100%;height:100%;border:0;"></iframe>`;
  viewer.style.display = 'block';
  downloadLink.href = url;
  downloadLink.setAttribute('download', file.filename);
}

viewerClose.addEventListener('click', ()=> viewer.style.display='none');

// 9️⃣ Download über Signed URL
async function downloadFile(file){
  const { data, error } = await supabase.storage.from(pdf-collab).createSignedUrl(file.path, 3600);
  if(error) return alert('Fehler: ' + error.message);
  window.open(data.signedUrl, '_blank');
}

// initialer Aufruf
fetchAndRender();
