# Puesta en producción · Fase 1

Tres piezas: una base **PostgreSQL 17**, la **API** (`api/`) y la **web** (`web/`). Las dos últimas tienen su `Dockerfile`; sirven en cualquier proveedor que ejecute contenedores. La web también se puede publicar sin contenedor en un servicio para Next.js.

## En Render

`render.yaml` crea las tres piezas en la región de Virginia: la base (`visionwize-db`), la API (`visionwize-api`) y la web (`visionwize-web`). La web llama a la API por la red privada a través de su puente `/api/v1`, así que no hay que configurar direcciones: la API toma la suya de Render y `APP_SECRET` se genera solo.

Después de crearlo:

1. Crear al dueño desde la *Shell* del servicio `visionwize-api`: `SEED_OWNER_PIN=<4 dígitos> SEED_DEMO=false npx prisma db seed`.
2. Seguir desde el punto 4 (primer acceso). La dirección pública de la API, para los webhooks de Twilio y Resend, es la del servicio `visionwize-api`.
3. Añadir las claves de Resend y Twilio en *Environment* del servicio `visionwize-api`.

Los despliegues son manuales (`autoDeployTrigger: off`) mientras el blueprint apunte a una rama de trabajo.

Los apartados siguientes describen cada pieza, para Render o para cualquier otro proveedor.

## 1. Base de datos

- PostgreSQL 17 con copias de seguridad diarias activadas.
- Una sola base y un usuario propio. La API aplica las migraciones al arrancar (`prisma migrate deploy`).

## 2. API

Una sola instancia: el envío de mensajes va con un reloj interno cada 10 minutos.

| Variable | Valor |
|---|---|
| `NODE_ENV` | `production` (la imagen ya lo pone) |
| `DATABASE_URL` | Conexión a la base |
| `PORT` | Puerto que pida el proveedor (por defecto 4000) |
| `APP_SECRET` | Aleatorio, 32 caracteres o más: `openssl rand -hex 32`. Firma los enlaces de baja; si se cambia, los enlaces ya enviados dejan de servir |
| `PUBLIC_API_URL` | Dirección pública de la API con `https://`, sin `/v1`. En Render no hace falta |
| `CORS_ORIGIN` | Dirección de la web con `https://`, o `none` si la web usa su puente |
| `SHOP_TZ` | Zona horaria de la tienda, p. ej. `America/New_York` |
| `SESSION_TTL_HOURS` | Horas que dura una sesión (por defecto 12) |
| `RESEND_API_KEY`, `EMAIL_FROM` | Correo. El dominio del remitente debe estar verificado en Resend |
| `RESEND_WEBHOOK_SECRET` | Secreto `whsec_…` del webhook de Resend |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | SMS. `TWILIO_FROM` es el número o el Messaging Service (`MG…`) |

Sin `APP_SECRET`, `PUBLIC_API_URL` o `CORS_ORIGIN` válidos la API no arranca y dice cuál falta. Sin las claves de Resend o Twilio arranca, pero los mensajes de ese canal se quedan en modo prueba.

Comprobación de salud para el proveedor: `GET /health`.

**Una sola vez**, con la API ya desplegada, crear al dueño (elija un PIN que no sea `0000` ni `1234`):

```bash
SEED_OWNER_PIN=<4 dígitos> SEED_DEMO=false npx prisma db seed
```

## 3. Web

Por defecto la web llama a la API a través de su puente `/api/v1`: basta con darle `API_HOSTPORT` (`servidor:puerto` de la API en la red privada) al arrancar, y en la API poner `CORS_ORIGIN=none`. Si se prefiere que el navegador llame a la API directamente, su dirección se fija al construir y `CORS_ORIGIN` debe ser la dirección de la web:

```bash
docker build --build-arg NEXT_PUBLIC_API_URL=https://<api>/v1 web
```

Debe servirse por `https` para que el iPad la instale como app («Añadir a pantalla de inicio»).

## 4. Primer acceso

1. Abrir la web **en el iPad de la tienda** y entrar como dueño. Ese primer PIN correcto autoriza el iPad; hasta entonces cualquiera que conozca la dirección podría probar el PIN, así que hágalo en cuanto esté desplegado.
2. En *Ajustes → Equipo*: cambiar el PIN del dueño si hace falta, añadir al equipo y generar un código por cada dispositivo adicional.
3. En *Ajustes → La óptica*: nombre y teléfono (salen en los mensajes). En *Ajustes → Mensajes*: revisar textos y horario de envío.
4. Si se pierde el único dispositivo autorizado: arrancar la API con `DEVICE_TRUST=false`, entrar, y volver a quitar la variable.

## 5. Mensajes

**Twilio (SMS)**

- Registro **A2P 10DLC** de la marca y la campaña: sin él los operadores de EE. UU. bloquean los SMS. Tarda días; conviene empezarlo ya.
- En el número o el Messaging Service, *A message comes in* → `POST {PUBLIC_API_URL}/v1/public/twilio/inbound`. El estado de entrega llega solo.

**Resend (correo)**

- Verificar el dominio de `EMAIL_FROM` (registros DNS que indica Resend).
- Crear un webhook a `POST {PUBLIC_API_URL}/v1/public/resend/webhook` con los eventos `email.delivered`, `email.bounced` y `email.complained`, y copiar su secreto en `RESEND_WEBHOOK_SECRET`. Un rebote marca el mensaje como fallido; una queja de spam da de baja al cliente.

**Prueba real antes de abrir**: en *Campañas*, crear un borrador y usar «Enviar prueba» a un teléfono y a un correo propios. En *Ajustes → Mensajes* debe aparecer como enviado y, al poco, como entregado.

## 6. Datos

- Importar los clientes desde *Ajustes → Importar y exportar*. La columna «Notas» no se importa salvo que se active, y nunca las notas con graduaciones, diagnósticos o seguros (cláusula 10.4).
- Los importados no reciben marketing hasta que den su consentimiento.
