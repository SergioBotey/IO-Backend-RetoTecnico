import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

//Health check importante para ver que el API este funcionando 👍
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'issuer-api' });
});

app.listen(PORT, () => {
  console.log(`issuer-api listening on port ${PORT}`);
});
