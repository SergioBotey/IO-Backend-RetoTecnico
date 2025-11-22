import { Router } from 'express';
import { issueCard } from '../controllers/cards.controller';

const router = Router();

// POST /cards/issue
router.post('/issue', issueCard);

export default router;