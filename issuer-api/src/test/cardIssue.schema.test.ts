import { cardIssueSchema } from '../validation/cardIssue.schema';

describe('cardIssueSchema', () => {
  const basePayload = {
    customer: {
      documentType: 'DNI',
      documentNumber: '12345678',
      fullName: 'Sergio Escalante',
      email: 'ejemplo@gmail.com',
      age: 25,
    },
    product: {
      type: 'VISA',
      currency: 'PEN',
      simulateError: false,
    },
  };

  it('debería aceptar un payload válido', () => {
    const result = cardIssueSchema.safeParse(basePayload);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customer.documentNumber).toBe('12345678');
      expect(result.data.product.type).toBe('VISA');
    }
  });

  it('debería fallar si falta un campo obligatorio (ej: documentNumber)', () => {
    const invalid = {
      ...basePayload,
      customer: {
        ...basePayload.customer,
        documentNumber: undefined,
      },
    };

    const result = cardIssueSchema.safeParse(invalid);

    expect(result.success).toBe(false);
  });

  it('debería fallar si age es menor a 18', () => {
    const invalid = {
      ...basePayload,
      customer: {
        ...basePayload.customer,
        age: 17,
      },
    };

    const result = cardIssueSchema.safeParse(invalid);

    expect(result.success).toBe(false);
  });
});