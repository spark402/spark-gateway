import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import fetch from 'node-fetch';
import { buildPaymentRequirements } from './x402.js';

const app = express();
app.use(helmet());
app.use(express.json());
app.use(morgan('dev'));

const VERIFIER_URL = process.env.VERIFIER_URL || 'http://localhost:8788';

app.get('/', (_req, res) => res.json({ ok: true, name: 'Spark Gateway', version: '0.1.0' }));

app.get('/protected/data', async (req, res) => {
  const xpay = req.header('X-PAYMENT');
  if (!xpay) {
    const quote = buildPaymentRequirements({ resource: '/protected/data', mint: process.env.MINT_PUBKEY || 'So11111111111111111111111111111111111111112', payTo: process.env.TREASURY_PUBKEY || '11111111111111111111111111111111', network: (process.env.NETWORK as any) || 'devnet' });
    return res.status(402).json(quote);
  }
  const ref = (() => { try { return JSON.parse(Buffer.from(xpay, 'base64').toString()).ref } catch { return null } })();
  if (!ref) return res.status(400).json({ error: 'malformed_payment_header' });
  try {
    const r = await fetch(`${VERIFIER_URL}/verify?ref=${encodeURIComponent(ref)}`);
    const body = await r.json();
    if (r.status === 200 && body?.ok) {
      res.setHeader('X-PAYMENT-RESPONSE', JSON.stringify({ ref, state: 'settled' }));
      return res.json({ secret: '🎉 you have access', ts: Date.now() });
    }
    if (r.status === 409) return res.status(409).json({ error: 'pending_confirmation', ref });
    return res.status(401).json({ error: 'payment_not_verified', ref, details: body });
  } catch (e) {
    return res.status(502).json({ error: 'verifier_unavailable' });
  }
});

app.use((_req, res) => res.status(404).json({ error: 'not_found' }));
const port = Number(process.env.PORT || 8787);
app.listen(port, () => console.log(`[Spark Gateway] http://localhost:${port}`));
