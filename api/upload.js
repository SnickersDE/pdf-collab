import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Missing Supabase environment variables.' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { fileName, fileContent, folder } = req.body;

    if (!fileName || !fileContent || !folder) {
      return res.status(400).json({ error: 'Missing fileName, fileContent, or folder.' });
    }

    const timestamp = Date.now();
    const safeFileName = fileName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-\.]/g, '');
    const path = `${folder}/anon_${timestamp}_${safeFileName}`;

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
      folder,
      owner: null
    }]);

    if (insertError) {
      console.error('DB Insert Error:', insertError);
      return res.status(400).json({ error: insertError.message });
    }

    return res.status(200).json({ message: 'Upload successful', path: uploadData.path });
  } catch (err) {
    console.error('Unexpected Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
}
