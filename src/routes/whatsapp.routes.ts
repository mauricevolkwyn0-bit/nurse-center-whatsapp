import { Router, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import config from '../config';
import logger from '../utils/logger';
import { whatsappService } from '../services/whatsapp.service';
import { getSupabase } from '../config/supabase';

const router = Router();

const GREETING_WORDS = ['hi', 'hello', 'hey', 'howzit', 'hola', 'good morning', 'good afternoon', 'good evening'];

// Meta sends a GET to verify the webhook — respond with the challenge token
router.get('/', (req: Request, res: Response) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
    logger.info('WhatsApp webhook verified');
    res.status(StatusCodes.OK).send(challenge);
  } else {
    logger.warn('WhatsApp webhook verification failed', { mode, token });
    res.sendStatus(StatusCodes.FORBIDDEN);
  }
});

// Meta sends incoming messages and status updates via POST
router.post('/', async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;

  if (body.object !== 'whatsapp_business_account') {
    res.sendStatus(StatusCodes.NOT_FOUND);
    return;
  }

  await handleIncoming(body);
  res.sendStatus(StatusCodes.OK);
});

async function lookupUserByPhone(rawNumber: string): Promise<{ role: string; name: string } | null> {
  try {
    const sb = getSupabase();
    const significant = rawNumber.replace(/\D/g, '').slice(-9);

    const { data: ppRows, error: ppErr } = await sb
      .from('profiles_private')
      .select('id')
      .like('phone', `%${significant}`);

    console.log('[NC] phone-lookup', JSON.stringify({ significant, matches: ppRows?.length ?? 0, error: ppErr?.message ?? null }));

    if (!ppRows?.length) return null;

    for (const row of ppRows as { id: string }[]) {
      const { data: profile, error: profErr } = await sb
        .from('profiles')
        .select('role, full_name, deleted_at')
        .eq('id', row.id)
        .maybeSingle();

      console.log('[NC] profile-row', JSON.stringify({ id: row.id, role: (profile as Record<string, unknown> | null)?.role ?? null, deleted_at: (profile as Record<string, unknown> | null)?.deleted_at ?? null, error: profErr?.message ?? null }));

      if (!profile) continue;
      const p = profile as { role: string; full_name: string; deleted_at: string | null };
      if (p.deleted_at) continue;
      if (p.role !== 'caregiver' && p.role !== 'patient') continue;
      return { role: p.role, name: p.full_name };
    }

    return null;
  } catch (err) {
    logger.error('Phone lookup error', { err });
    return null;
  }
}

async function sendGreeting(from: string, user: { role: string; name: string } | null): Promise<void> {
  const firstName = user?.name.split(' ')[0] ?? '';

  if (user?.role === 'caregiver') {
    await whatsappService.sendInteractiveButtons({
      to: from,
      headerText: `Welcome back, ${firstName}! 👋`,
      bodyText: 'What would you like to do today?',
      buttons: [
        { id: 'nurse_jobs', title: 'View Jobs' },
        { id: 'nurse_profile', title: 'My Profile' },
        { id: 'support', title: 'Support' },
      ],
    });
  } else if (user?.role === 'patient') {
    await whatsappService.sendInteractiveButtons({
      to: from,
      headerText: `Welcome back, ${firstName}! 👋`,
      bodyText: 'How can we help you today?',
      buttons: [
        { id: 'client_request', title: 'Request a Nurse' },
        { id: 'my_bookings', title: 'My Bookings' },
        { id: 'support', title: 'Support' },
      ],
    });
  } else {
    await whatsappService.sendInteractiveButtons({
      to: from,
      headerText: 'Welcome to Nurse Center 👋',
      bodyText: "Hello! I'm the Nurse Center assistant. How can I help you today?",
      buttons: [
        { id: 'nurse_signup', title: 'Register as Nurse' },
        { id: 'client_request', title: 'Request a Nurse' },
        { id: 'learn_more', title: 'Learn More' },
      ],
    });
  }
}

async function handleIncoming(body: Record<string, unknown>): Promise<void> {
  try {
    const entry = (body.entry as { changes: { value: { messages?: { from: string; type: string; text?: { body: string }; id: string }[] } }[] }[] | undefined)?.[0];
    const value = entry?.changes?.[0]?.value;
    const messages = value?.messages;

    if (!messages?.length) return;

    for (const msg of messages) {
      const from = msg.from;
      const text = msg.type === 'text' ? msg.text?.body?.trim().toLowerCase() ?? '' : '';

      logger.info('Incoming message', { from, text });

      if (GREETING_WORDS.some((w) => text.startsWith(w))) {
        const sig = from.replace(/\D/g, '').slice(-9);
        const sb = getSupabase();
        const { data: ppRows, error: ppErr } = await sb.from('profiles_private').select('id').like('phone', `%${sig}`);
        const profileRows: Array<{ role: string | null; deleted: boolean }> = [];
        for (const row of (ppRows ?? []) as { id: string }[]) {
          const { data: prof } = await sb.from('profiles').select('role, deleted_at').eq('id', row.id).maybeSingle();
          const p = prof as { role: string; deleted_at: string | null } | null;
          if (p) profileRows.push({ role: p.role, deleted: !!p.deleted_at });
        }
        const user = await lookupUserByPhone(from);
        logger.info('Greeting debug', { from, sig, dbMatches: ppRows?.length ?? 0, dbError: ppErr?.message ?? null, profileRows, found: !!user, role: user?.role ?? 'none' });
        await sendGreeting(from, user);
      }
    }
  } catch (err) {
    logger.error('Error handling incoming WhatsApp message', { err });
  }
}

export default router;
