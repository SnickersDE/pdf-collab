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
    const { path } = req.body;

    if (!path) {
      return res.status(400).json({ error: 'Missing file path.' });
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('pdf-collab')
      .remove([path]);

    if (storageError) {
      console.error('Storage Delete Error:', storageError);
      return res.status(400).json({ error: storageError.message });
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('files')
      .delete()
      .eq('path', path);

    if (dbError) {
      console.error('DB Delete Error:', dbError);
      return res.status(400).json({ error: dbError.message });
    }

    return res.status(200).json({ message: 'Delete successful', path });
  } catch (err) {
    console.error('Unexpected Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
}
