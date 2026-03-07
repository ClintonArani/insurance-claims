import express from 'express';
import {
  createPolicy,
  getPolicy,
  getClientPolicies
} from '../controllers/policyController';
import { validatePolicy } from '../middleware/validation';

const router = express.Router();

router.post('/', validatePolicy, createPolicy);
router.get('/:policyId', getPolicy);
router.get('/client/:clientId', getClientPolicies);

export default router;