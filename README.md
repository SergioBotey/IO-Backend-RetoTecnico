# IO Backend Challenge – Card Issuer & Card Processor  
By: Sergio Escalante

Monorepo con dos servicios:

- **`issuer-api`**: API HTTP para solicitar emisión de tarjetas y publicar eventos hacia Kafka.
- **`card-processor`**: consumidor Kafka que procesa las solicitudes, simula la emisión de tarjetas y publica los resultados (eventos + logs).

---

## 1. Requisitos

- Node.js >= 20 
- npm >= 9  
- Docker & Docker Compose

---

## 2. Estructura del proyecto

```txt
io-backend/
  docker-compose.yml
  issuer-api/
    src/
      app.ts
      index.ts
      controllers/
        cards.controller.ts
      routes/
        cards.routes.ts
      validation/
        cardIssue.schema.ts
      kafka/
        kafka.ts
      domain/
        types.ts
        events.ts
      test/
        cardIssue.schema.test.ts
        cards.issue.integration.test.ts
    package.json
    tsconfig.json

  card-processor/
    src/
      index.ts
      kafka/
        kafka.ts
      domain/
        types.ts
        events.ts
      repositories/
        cardRequestRepository.ts
      utils/
        delay.ts
        generators.ts
    package.json
    tsconfig.json
```

---

## 3. Levantar Kafka con Docker

Desde la raíz del monorepo (`io-backend`):

```bash
docker compose up -d
```

Esto levanta:

- Zookeeper  
- Kafka broker (expuesto en `localhost:9092`)

Para revisar el estado de los contenedores:

```bash
docker ps
```

---

## 4. Crear tópicos de Kafka

Los servicios utilizan los siguientes tópicos:

- `io.card.requested.v1` – solicitudes de emisión.
- `io.cards.issued.v1` – tarjetas emitidas.
- `io.card.requested.v1.dlq` – DLQ para solicitudes que fallaron tras reintentos.

### 4.1. Comandos para crearlos

Desde la raíz del proyecto:

```bash
# Topic de solicitudes
docker exec -it io-backend-kafka kafka-topics --bootstrap-server localhost:9092 --create --topic io.card.requested.v1 --replication-factor 1 --partitions 1

# Topic de tarjetas emitidas
docker exec -it io-backend-kafka kafka-topics --bootstrap-server localhost:9092 --create --topic io.cards.issued.v1 --replication-factor 1 --partitions 1

# DLQ
docker exec -it io-backend-kafka kafka-topics --bootstrap-server localhost:9092 --create --topic io.card.requested.v1.dlq --replication-factor 1 --partitions 1
```

### 4.2. Validar que los tópicos existan

```bash
docker exec -it io-backend-kafka kafka-topics --bootstrap-server localhost:9092 --list
```

---

## 5. `issuer-api`

### 5.1. Instalación y ejecución

Desde la raíz del repo:

```bash
cd issuer-api
npm install
npm run dev
```

La API quedará levantada en:
http://localhost:3000


---

### 5.2. Endpoint principal: `POST /cards/issue`

Solicita la emisión de una tarjeta para un cliente y publica un evento a Kafka (`io.card.requested.v1`).

#### Request body (ejemplo)

```json
{
  "customer": {
    "documentType": "DNI",
    "documentNumber": "12345678",
    "fullName": "Nombre Apellido",
    "email": "cliente@example.com",
    "age": 25
  },
  "product": {
    "type": "VISA",
    "currency": "PEN",
    "simulateError": false
  }
}
```

#### Reglas de negocio / validación

- `customer.age` **>= 18**.  
- `product.type` es `{ "VISA", "MASTERCARD" }`.  
- `product.currency` es `{ "PEN", "USD" }`.  
- `product.simulateError` boolean:
  - `false` → camino normal.
  - `true`  → fuerza fallos en el procesamiento para probar reintentos + DLQ.
  
- Regla “**una tarjeta por cliente**”: no se permiten múltiples tarjetas para el mismo `documentNumber` (cliente).

#### Response `202 – Accepted`

```json
{
  "requestId": "id-aleatorio",
  "status": "PENDING"
}
```

> La emisión es asíncrona. El resultado final se refleja en eventos de Kafka (`io.cards.issued.v1` o DLQ).

#### Response `400 – Payload inválido`

```json
{
  "message": "Error de validación",
  "errors": [
    {
      "path": "customer.email",
      "message": "Invalid email"
    }
  ]
}
```

#### Response `409 – Cliente ya tiene tarjeta`

```json
{
  "message": "El cliente ya tiene una tarjeta en proceso o emitida",
  "requestId": "request-id-existente",
  "status": "PENDING"
}
```

---

## 6. `card-processor`

### 6.1. Instalación y ejecución

```bash
cd card-processor
npm install
npm run dev
```

Al arrancar, el servicio:
- Se conecta a Kafka.
- Se suscribe al tópico `io.card.requested.v1`.
- Procesa mensajes de manera continua.

---

### 6.2. Flujo general

Cuando lleg un mensaje al topico `io.card.requested.v1` (`CardRequestedEvent`):

```json
{
  "requestId": "uuid",
  "customer": {
    "documentType": "DNI",
    "documentNumber": "12345678",
    "fullName": "Nombre Apellido",
    "email": "cliente@example.com",
    "age": 25
  },
  "product": {
    "type": "VISA",
    "currency": "PEN",
    "simulateError": false
  },
  "status": "PENDING",
  "attempts": 0
}
```

El `card-processor`:

1. Guarda el request en un (`CardRequestRepository`). Este repositorio vendría a ser la memoria para el caso.
2. Llama a `simulateExternalCall(event)`:
   - Si `simulateError === true`, la llamada simula fallo siempre.
   - Si no, tiene una probabilidad de éxito (~70%).

---

### 6.3. Happy Path (exito)

- Se genera `cardData` (por el momento: cardNumber,expirationMonth,cvv,etc.)
- Se actualiza el repositorio a `status = "ISSUED"`.
- Se publica un evento `CardIssuedEvent` en el tópico `io.cards.issued.v1`:

```json de ejemplo
{
  "requestId": "uuid",
  "customer": {},
  "card": {
    "cardId": "uuid-card",
    "cardNumber": "8902369549075327",
    "expirationMonth": 12,
    "expirationYear": 2030,
    "cvv": "123"
  },
  "status": "ISSUED",
  "issuedAt": "2025-01-01T00:00:00.000Z"
}
```
---

### 6.4. Reintentos + DLQ

Si `simulateExternalCall` falla:

1. Se revisa el campo `attempts`:
   - Si `attempts < MAX_ATTEMPTS` (por ejemplo < 3):
     - Se calcula un **backoff exponencial**, por ejemplo:
       - intento 0 → 1s  
       - intento 1 → 2s  
       - intento 2 → 4s  
     - Se vuelve a publicar el evento en `io.card.requested.v1` con `attempts + 1`.
   - Si `attempts >= MAX_ATTEMPTS`:
     - Se marca el request en el repositorio con `status = "FAILED"`.
     - Se publica un `CardRequestedDlqEvent` en `io.card.requested.v1.dlq`:

```json esperado en io.card.requested.v1.dlq
{
  "requestId": "uuid",
  "reason": "Max retries exceeded",
  "attempts": 3,
  "originalPayload": {
    "requestId": "uuid",
    "customer": {},
    "product": {
      "type": "VISA",
      "currency": "PEN",
      "simulateError": true
    },
    "status": "PENDING",
    "attempts": 3
  }
}
```

---

### 6.5. Ver eventos en consola

Para inspeccionar los mensajes producidos en cada tópico:

```bash
# Solicitudes de emisión
docker exec -it io-backend-kafka   kafka-console-consumer --bootstrap-server localhost:9092   --topic io.card.requested.v1 --from-beginning

# Tarjetas emitidas
docker exec -it io-backend-kafka   kafka-console-consumer --bootstrap-server localhost:9092   --topic io.cards.issued.v1 --from-beginning

# DLQ (solicitudes que fallaron tras 3 reintentos)
docker exec -it io-backend-kafka   kafka-console-consumer --bootstrap-server localhost:9092   --topic io.card.requested.v1.dlq --from-beginning
```

---

## 7. Ejemplos de prueba end-to-end

### 7.1. Caso éxito (`simulateError = false`)

**Request**

```http
POST http://localhost:3000/cards/issue
Content-Type: application/json
```

```json
{
  "customer": {
    "documentType": "DNI",
    "documentNumber": "11111111",
    "fullName": "Cliente Exitoso",
    "email": "cliente.ok@example.com",
    "age": 28
  },
  "product": {
    "type": "VISA",
    "currency": "PEN",
    "simulateError": false
  }
}
```

**Comportamiento esperado**

- `issuer-api` → `202 Accepted` con `{ "requestId": "...", "status": "PENDING" }`.  
- `card-processor` → produce un `CardIssuedEvent` en `io.cards.issued.v1`.

---

### 7.2. Caso error forzado + DLQ (`simulateError = true`)

**Request**

```http
POST http://localhost:3000/cards/issue
Content-Type: application/json
```

```json
{
  "customer": {
    "documentType": "DNI",
    "documentNumber": "22222222",
    "fullName": "Cliente Problemático",
    "email": "cliente.fail@example.com",
    "age": 35
  },
  "product": {
    "type": "VISA",
    "currency": "PEN",
    "simulateError": true
  }
}
```

**Comportamiento esperado**

- `issuer-api` → `202 Accepted`.  
- `card-processor`:
  - Reintenta varias veces (con backoff exponencial).
  - Marca el request como `FAILED` en el repositorio.
  - Publica un mensaje en `io.card.requested.v1.dlq`.

---

### 7.3. Cliente con tarjeta ya emitida (`409 Conflict`)

Enviar dos veces el mismo body (mismo `documentNumber`):

1. **Primera llamada** → `202 Accepted`.
2. **Segunda llamada** → `409 Conflict`:

```json
{
  "message": "El cliente ya tiene una tarjeta en proceso o emitida",
  "requestId": "request-id-de-la-primera-solicitud",
  "status": "PENDING"
}
```

---

## 8. Testing

Los tests están implementados sobre `issuer-api` para cubrir:

- validación de payload,
- reglas de negocio (edad mínima, unicidad por cliente),
- comportamiento HTTP (202 / 400 / 409).

Se utiliza:

- **Jest + ts-jest** para el runner y soporte TS.
- **supertest** para pruebas de integración HTTP.

### 8.1. Ejecutar tests

Desde la carpeta `issuer-api`:

```bash
npm test
```

### 8.2. Cobertura de tests

- **Unitarios**
  - `cardIssue.schema.test.ts`: pruebas sobre el schema Zod (`cardIssueSchema`):
    - Payload válido.
    - Campos obligatorios faltantes.
    - Edad menor a 18, etc.

- **Integración (HTTP + validación + repo)**
  - `cards.issue.integration.test.ts`:
    - `POST /cards/issue` con payload válido → `202` + `requestId`.
    - Payload inválido → `400` con detalle de errores.
    - Cliente con tarjeta ya emitida → `409` (regla “una tarjeta por cliente”).

Los tests de integración simulan(o bueno hacen un mock) `getKafkaProducer` para no depender de Kafka en tiempo de test.

---
