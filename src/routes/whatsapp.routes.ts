import { Router, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import config from '../config';
import logger from '../utils/logger';

const router = Router();

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
router.post('/', (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;

  if (body.object === 'whatsapp_business_account') {
    logger.info('WhatsApp webhook event received', { body: JSON.stringify(body) });
    // TODO: route to flow handler
    res.sendStatus(StatusCodes.OK);
  } else {
    res.sendStatus(StatusCodes.NOT_FOUND);
  }
});

export default router;
