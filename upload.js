import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { fileName, fileContent } = req.body;

  const { data, error } = await supabase.storage
    .from('pdf-collab')
    .upload(`current/${fileName}`, Buffer.from(fileContent, 'base64'), {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (error) return res.status(400).json({ error });
  res.status(200).json({ data });
}
