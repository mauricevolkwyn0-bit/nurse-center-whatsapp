import { Router, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import config from '../config';
import logger from '../utils/logger';
import { whatsappService } from '../services/whatsapp.service';

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
        await whatsappService.sendInteractiveButtons({
          to: from,
          headerText: 'Welcome to Nurse Center 👋',
          bodyText: 'Hello! I\'m the Nurse Center assistant. How can I help you today?',
          buttons: [
            { id: 'nurse_signup', title: 'Register as Nurse' },
            { id: 'client_request', title: 'Request a Nurse' },
            { id: 'learn_more', title: 'Learn More' },
          ],
        });
      }
    }
  } catch (err) {
    logger.error('Error handling incoming WhatsApp message', { err });
  }
}

export default router;
