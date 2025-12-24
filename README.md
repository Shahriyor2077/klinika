# ORFAN.UZ - Bemorlarni ro'yxatga olish tizimi

Express.js + Handlebars + MongoDB

## Talablar

- Node.js >= 18.0.0
- MongoDB >= 6.0

## O'rnatish

```bash
cd express-app
npm install
```

## Sozlash

1. `.env.example` faylini `.env` ga nusxalang:
```bash
cp .env.example .env
```

2. `.env` faylini tahrirlang:
```
PORT=2000
MONGODB_URI=mongodb://localhost:27017/mukovatsidoz
SESSION_SECRET=kamida-32-belgili-maxfiy-kalit
API_SECRET_KEY=telegram-bot-uchun-api-kalit
SMS_TOKEN=eskiz-sms-token
SMS_SERVICE_URL=https://notify.eskiz.uz/api/message/sms/send
SMS_TEMPLATE=Mukovatsidoz: {otp}
NODE_ENV=production
```

## Seed (boshlang'ich ma'lumotlar)

```bash
npm run seed
```

Bu buyruq:
- Dorilar ro'yxatini yaratadi
- Admin yaratadi (login: `admin`, parol: `admin123`)
- Test shifokor yaratadi (tel: `998901234567`, parol: `123456`)

## Ishga tushirish

```bash
# Development
npm run dev

# Production
npm start
```

Server: http://localhost:2000

## Deploy (Production)

### Railway / Render / Heroku

1. GitHub ga push qiling
2. Platformada yangi loyiha yarating
3. Environment variables qo'shing:
   - `MONGODB_URI` - MongoDB Atlas connection string
   - `SESSION_SECRET` - Maxfiy kalit
   - `API_SECRET_KEY` - API kaliti
   - `SMS_TOKEN` - Eskiz token
   - `NODE_ENV=production`

### VPS (Ubuntu)

```bash
# Node.js o'rnatish
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2 o'rnatish
sudo npm install -g pm2

# Loyihani clone qilish
git clone <repo-url>
cd express-app
npm install

# .env sozlash
cp .env.example .env
nano .env

# Seed
npm run seed

# PM2 bilan ishga tushirish
pm2 start app.js --name mukovatsidoz
pm2 save
pm2 startup
```

### Nginx reverse proxy

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:2000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## API Endpoints

Barcha API endpointlari `X-API-Key` header talab qiladi.

- `POST /api/register` - Shifokor ro'yxatdan o'tishi
- `GET /api/profile?telegram_id=123` - Shifokor profili
- `POST /api/reset-password` - Parol tiklash
- `GET /api/patient/:pnfl` - Bemor qidirish
- `GET /api/stats` - Statistika

## Xavfsizlik

- Rate limiting (login, OTP, API)
- Helmet security headers
- XSS protection
- Input validation & sanitization
- Session-based authentication
- API key authentication

## Litsenziya

MIT
