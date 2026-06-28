import { signToken } from './_adminAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const { user, pass } = req.body || {};
  if (user !== process.env.ADMIN_USER || pass !== process.env.ADMIN_PASS) {
    res.status(401).json({ error: 'IDまたはパスワードが正しくありません' });
    return;
  }

  res.status(200).json({ token: signToken() });
}
