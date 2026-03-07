import express from 'express';
import {
  createClient,
  getClient,
  getAllClients,
  getTotalPremiumByClient
} from '../controllers/clientController';
import { validateClient } from '../middleware/validation';

const router = express.Router();

router.post('/', validateClient, createClient);
router.get('/', getAllClients);
router.get('/:clientId', getClient);
router.get('/:clientId/total-premium', getTotalPremiumByClient);

export default router;