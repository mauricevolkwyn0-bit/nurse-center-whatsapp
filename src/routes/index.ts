import { Router } from 'express';
import healthRoutes from './health.routes';
import whatsappRoutes from './whatsapp.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/webhooks/whatsapp', whatsappRoutes);

export default router;
