import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { fileName, fileContent } = req.body;
  const timestamp = Date.now();
  const safeFileName = fileName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-\.]/g, '');
  const path = `current/anon_${timestamp}_${safeFileName}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('pdf-collab')
    .upload(path, Buffer.from(fileContent, 'base64'), {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) {
    console.error('Storage Error:', uploadError);
    return res.status(400).json({ error: uploadError.message });
  }

  const { error: insertError } = await supabase.from('files').insert([{
    filename: fileName,
    path: uploadData.path,
    size: Buffer.from(fileContent, 'base64').length,
    folder: 'current',
    owner: null
  }]);

  if (insertError) {
    console.error('DB Insert Error:', insertError);
    return res.status(400).json({ error: insertError.message });
  }

  res.status(200).json({ message: 'Upload successful', path: uploadData.path });
}
