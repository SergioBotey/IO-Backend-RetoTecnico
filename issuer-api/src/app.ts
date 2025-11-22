import express from 'express';
import cardsRouter from './routes/cards.routes';

const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'issuer-api' });
});

app.use('/cards', cardsRouter);

export { app };