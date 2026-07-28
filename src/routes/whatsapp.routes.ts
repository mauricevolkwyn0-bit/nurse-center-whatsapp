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

    const { data: ppRows } = await sb
      .from('profiles_private')
      .select('id')
      .like('phone', `%${significant}`);

    if (!ppRows?.length) return null;

    let fallback: { role: string; name: string } | null = null;

    for (const row of ppRows as { id: string }[]) {
      const { data: profile } = await sb
        .from('profiles')
        .select('role, full_name, deleted_at')
        .eq('id', row.id)
        .maybeSingle();

      if (!profile) continue;
      const p = profile as { role: string; full_name: string; deleted_at: string | null };
      if (p.deleted_at) continue;
      if (p.role !== 'caregiver' && p.role !== 'patient') continue;

      // Prefer caregiver over patient when multiple profiles exist
      if (p.role === 'caregiver') return { role: p.role, name: p.full_name };
      if (!fallback) fallback = { role: p.role, name: p.full_name };
    }

    return fallback;
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

async function handleButtonReply(from: string, buttonId: string, user: { role: string; name: string } | null): Promise<void> {
  switch (buttonId) {
    case 'support':
      await whatsappService.sendText({ to: from, body: 'For support, please contact us at support@nursecenter.co.za or call +27 75 524 6673.' });
      break;
    case 'learn_more':
      await whatsappService.sendText({ to: from, body: 'Nurse Center connects patients with qualified nurses for home care. Visit nursecenter.co.za to learn more.' });
      break;
    default:
      // Complex flows — coming soon
      await whatsappService.sendText({ to: from, body: `Hi ${user?.name.split(' ')[0] ?? 'there'}, this feature is coming soon. Type "hi" to return to the main menu.` });
  }
}

type IncomingMessage = {
  from: string;
  type: string;
  text?: { body: string };
  interactive?: { type: string; button_reply?: { id: string; title: string } };
  id: string;
};

async function handleIncoming(body: Record<string, unknown>): Promise<void> {
  try {
    const entry = (body.entry as { changes: { value: { messages?: IncomingMessage[] } }[] }[] | undefined)?.[0];
    const value = entry?.changes?.[0]?.value;
    const messages = value?.messages;

    if (!messages?.length) return;

    for (const msg of messages) {
      const from = msg.from;

      logger.info('Incoming message', { from, type: msg.type });

      if (msg.type === 'text') {
        const text = msg.text?.body?.trim().toLowerCase() ?? '';
        if (GREETING_WORDS.some((w) => text.startsWith(w))) {
          const user = await lookupUserByPhone(from);
          await sendGreeting(from, user);
        }
      } else if (msg.type === 'interactive' && msg.interactive?.button_reply) {
        const buttonId = msg.interactive.button_reply.id;
        const user = await lookupUserByPhone(from);
        logger.info('Button tap', { from, buttonId });
        await handleButtonReply(from, buttonId, user);
      }
    }
  } catch (err) {
    logger.error('Error handling incoming WhatsApp message', { err });
  }
}

export default router;
