import request from 'supertest';
import { app } from '../app';

jest.mock('../kafka/kafka', () => {
  const sendMock = jest.fn().mockResolvedValue(undefined);
  return {
    getKafkaProducer: jest.fn().mockResolvedValue({ send: sendMock }),
  };
});

describe('POST /cards/issue (integración)', () => {
  const baseBody = {
    customer: {
      documentType: 'DNI',
      documentNumber: '87654321',
      fullName: 'Cliente Integración',
      email: 'cliente.integracion@example.com',
      age: 30,
    },
    product: {
      type: 'VISA',
      currency: 'PEN',
      simulateError: false,
    },
  };

  it('debería devolver 202 y un requestId con payload válido', async () => {
    const response = await request(app)
      .post('/cards/issue')
      .send(baseBody)
      .expect(202);

    expect(response.body).toHaveProperty('requestId');
    expect(response.body.status).toBe('PENDING');
  });

  it('debería devolver 400 cuando el payload es inválido', async () => {
    const invalidBody = {
      ...baseBody,
      customer: {
        ...baseBody.customer,
        email: 'no-es-un-correo',
      },
    };

    const response = await request(app)
      .post('/cards/issue')
      .send(invalidBody)
      .expect(400);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('errors');
  });

  it('debería devolver 409 cuando el cliente ya tiene una tarjeta', async () => {
  const bodyFor409 = {
    ...baseBody,
    customer: {
      ...baseBody.customer,
      documentNumber: '99999999',            
      email: 'cliente.duplicado@ejemplo.com'
    },
  };

    await request(app)
      .post('/cards/issue')
      .send(bodyFor409)
      .expect(202);

    const response = await request(app)
      .post('/cards/issue')
      .send(bodyFor409)
      .expect(409);

    expect(response.body.message).toMatch(/ya tiene una tarjeta/i);
  });
});
