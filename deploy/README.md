# Deploy API → Vercel (api.sizor.online)
#
# Una vez:
#   npm i -g vercel
#   vercel login
#   vercel link
#
# Env en Vercel Dashboard (Production):
#   NODE_ENV=production
#   SIZOR_API_KEY=...
#   MATUDB_*=...
#   API_URL=https://sizor.online
#   DOMAIN=api.sizor.online
#   RABBITMQ_ENABLED=false
#   SCHEDULER_ENABLED=false
#
# Dominio:
#   vercel domains add api.sizor.online
#   (DNS CNAME → cname.vercel-dns.com que te indique Vercel)
#
# Deploy:
#   vercel --prod
#
# Límites serverless:
#   - Sin WebSocket persistente (/ws)
#   - Sin consumidor RabbitMQ in-process
#   - Sin node-cron in-process (usa Vercel Cron si lo necesitas)
#
# Local sigue igual: npm run dev

## Comandos

```bash
cd sizor-api
vercel --prod
```
