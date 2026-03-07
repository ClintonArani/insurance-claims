import express from 'express';
import {
  submitClaim,
  processClaim,
  getClientClaims,
  getClaim,
  getTotalClaimsByPolicyType
} from '../controllers/claimController';
import { validateClaim, validateProcessClaim } from '../middleware/validation';

const router = express.Router();

router.post('/', validateClaim, submitClaim);
router.get('/policy-type-summary', getTotalClaimsByPolicyType);
router.get('/:claimId', getClaim);
router.post('/:claimId/process', validateProcessClaim, processClaim);
router.get('/client/:clientId', getClientClaims);

export default router;