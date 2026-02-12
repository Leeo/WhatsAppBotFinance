# 🚀 Guia de Deploy em VPS - Assistente Financeiro WhatsApp

Guia completo para rodar o bot de WhatsApp em um servidor VPS com alta disponibilidade.

---

## 📋 Requisitos do Servidor

### Mínimo Recomendado
| Recurso | Especificação |
|---------|---------------|
| CPU | 2 vCPUs |
| RAM | 4 GB |
| Disco | 20 GB SSD |
| SO | Ubuntu 22.04 LTS |
| Rede | IP Público + Portas 80/443/3000 |

### Provedores Sugeridos
- **DigitalOcean** - $24/mês (4GB RAM)
- **Hetzner** - €7.51/mês (4GB RAM) - Ótimo custo-benefício
- **AWS Lightsail** - $10/mês (2GB RAM)
- **Vultr** - $20/mês (4GB RAM)

---

## 🛠️ Instalação Passo a Passo

### 1. Acesse o Servidor

```bash
ssh root@SEU_IP_VPS
```

### 2. Atualize o Sistema

```bash
apt update && apt upgrade -y
```

### 3. Instale o Node.js 20

```bash
# Instalação via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verifique
node -v  # v20.x.x
npm -v   # 10.x.x
```

### 4. Instale o PM2 (Gerenciador de Processos)

```bash
npm install -g pm2
```

### 5. Instale o Chrome (OBRIGATÓRIO para o bot)

```bash
# Instale dependências
apt install -y wget gnupg ca-certificates procps libxss1

# Baixe e instale o Chrome
wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -
echo "deb http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list
apt update
apt install -y google-chrome-stable

# Verifique
google-chrome --version
```

### 6. Instale o Nginx

```bash
apt install -y nginx
systemctl enable nginx
systemctl start nginx
```

### 7. Instale o Git

```bash
apt install -y git
```

---

## 📦 Deploy da Aplicação

### 1. Clone o Projeto

```bash
cd /opt
git clone https://github.com/seu-usuario/whatsapp-finance-bot.git
# Ou faça upload via SCP/SFTP
```

### 2. Instale as Dependências do Backend

```bash
cd /opt/whatsapp-finance-bot
npm install
```

### 3. Instale as Dependências do Frontend

```bash
cd /opt/whatsapp-finance-bot/web
npm install
npm run build
cd ..
```

### 4. Configure as Variáveis de Ambiente

```bash
cp .env.example .env
nano .env
```

Conteúdo do `.env`:
```env
NODE_ENV=production
PORT=3000

# Configurações do Bot
BOT_SESSION_NAME=finance-bot-session
BOT_HEADLESS=true

# Diretórios
UPLOAD_DIR=./uploads
DATA_DIR=./data

# Configurações de OCR
OCR_LANGUAGE=por
OCR_PSM=6
```

### 5. Crie as Pastas Necessárias

```bash
mkdir -p uploads/pdfs uploads/images data
chmod -R 755 uploads data
```

---

## ⚙️ Configuração do PM2

### 1. Crie o arquivo de configuração

```bash
nano /opt/whatsapp-finance-bot/ecosystem.config.js
```

Conteúdo:
```javascript
module.exports = {
  apps: [
    {
      name: 'finance-bot-api',
      script: './src/index.js',
      cwd: '/opt/whatsapp-finance-bot',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '1G',
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false,
      // Importante para o Puppeteer
      args: '--no-sandbox --disable-setuid-sandbox'
    },
    {
      name: 'finance-bot-web',
      script: 'serve',
      cwd: '/opt/whatsapp-finance-bot/web',
      instances: 1,
      exec_mode: 'fork',
      env: {
        PM2_SERVE_PATH: './dist',
        PM2_SERVE_PORT: 5173,
        PM2_SERVE_SPA: 'true'
      },
      log_file: './logs/web.log'
    }
  ]
};
```

### 2. Instale o serve globalmente

```bash
npm install -g serve
```

### 3. Crie a pasta de logs

```bash
mkdir -p /opt/whatsapp-finance-bot/logs
```

### 4. Inicie com PM2

```bash
cd /opt/whatsapp-finance-bot
pm2 start ecosystem.config.js

# Salve a configuração
pm2 save

# Configure para iniciar no boot
pm2 startup systemd
# Execute o comando que ele mostrar
```

### 5. Comandos Úteis do PM2

```bash
# Ver status
pm2 status
pm2 logs

# Restart
pm2 restart finance-bot-api

# Parar
pm2 stop finance-bot-api

# Monitor em tempo real
pm2 monit

# Ver logs
pm2 logs finance-bot-api --lines 100
```

---

## 🌐 Configuração do Nginx

### 1. Crie o arquivo de configuração

```bash
nano /etc/nginx/sites-available/whatsapp-finance-bot
```

Conteúdo:
```nginx
# Redirecionar HTTP para HTTPS
server {
    listen 80;
    server_name seu-dominio.com www.seu-dominio.com;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# Backend API
server {
    listen 443 ssl http2;
    server_name api.seu-dominio.com;
    
    # SSL (será configurado pelo Certbot)
    ssl_certificate /etc/letsencrypt/live/seu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seu-dominio.com/privkey.pem;
    
    # Logs
    access_log /var/log/nginx/finance-bot-api-access.log;
    error_log /var/log/nginx/finance-bot-api-error.log;
    
    # Proxy para a API
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # WebSocket support (se necessário)
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}

# Frontend Web
server {
    listen 443 ssl http2;
    server_name app.seu-dominio.com;
    
    # SSL
    ssl_certificate /etc/letsencrypt/live/seu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seu-dominio.com/privkey.pem;
    
    # Logs
    access_log /var/log/nginx/finance-bot-web-access.log;
    error_log /var/log/nginx/finance-bot-web-error.log;
    
    # Root do frontend
    root /opt/whatsapp-finance-bot/web/dist;
    index index.html;
    
    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Cache de assets estáticos
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # API proxy
    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2. Ative o site

```bash
ln -s /etc/nginx/sites-available/whatsapp-finance-bot /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

---

## 🔒 SSL com Let's Encrypt

### 1. Instale o Certbot

```bash
apt install -y certbot python3-certbot-nginx
```

### 2. Obtenha os certificados

```bash
certbot --nginx -d seu-dominio.com -d www.seu-dominio.com -d api.seu-dominio.com -d app.seu-dominio.com
```

### 3. Renovação automática

```bash
# Teste a renovação
certbot renew --dry-run

# O cron já é configurado automaticamente
# Verifique: cat /etc/cron.d/certbot
```

---

## 🔥 Firewall (UFW)

```bash
# Instale
apt install -y ufw

# Configure
ufw default deny incoming
ufw default allow outgoing

# Portas necessárias
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS

# Ative
ufw enable

# Verifique
ufw status
```

---

## 📊 Monitoramento

### 1. Script de Health Check

```bash
nano /opt/whatsapp-finance-bot/health-check.sh
```

```bash
#!/bin/bash

# Health check do bot
API_URL="http://localhost:3000/health"
LOG_FILE="/opt/whatsapp-finance-bot/logs/health-check.log"

response=$(curl -s -o /dev/null -w "%{http_code}" $API_URL)

if [ $response -ne 200 ]; then
    echo "$(date): API retornou $response - Reiniciando..." >> $LOG_FILE
    pm2 restart finance-bot-api
else
    echo "$(date): API OK" >> $LOG_FILE
fi
```

```bash
chmod +x /opt/whatsapp-finance-bot/health-check.sh
```

### 2. Cron para health check

```bash
crontab -e
```

Adicione:
```
# Health check a cada 5 minutos
*/5 * * * * /opt/whatsapp-finance-bot/health-check.sh

# Limpeza de logs semanal (domingo 3h)
0 3 * * 0 find /opt/whatsapp-finance-bot/logs -name "*.log" -type f -mtime +7 -delete
```

---

## 🔄 Atualização da Aplicação

Crie um script de deploy:

```bash
nano /opt/whatsapp-finance-bot/deploy.sh
```

```bash
#!/bin/bash

echo "🚀 Iniciando deploy..."

cd /opt/whatsapp-finance-bot

# Backup do banco
cp data/expenses.db "data/expenses.db.backup.$(date +%Y%m%d%H%M%S)"

# Pull das atualizações
git pull origin main

# Atualiza backend
npm install

# Atualiza frontend
cd web
npm install
npm run build
cd ..

# Restart dos serviços
pm2 restart ecosystem.config.js

echo "✅ Deploy concluído!"
```

```bash
chmod +x /opt/whatsapp-finance-bot/deploy.sh
```

---

## 🐛 Troubleshooting VPS

### Problema: Bot não conecta ao WhatsApp

```bash
# Verifique se o Chrome está instalado
google-chrome --version

# Verifique logs
pm2 logs finance-bot-api

# Delete a sessão e reconecte
rm -rf /opt/whatsapp-finance-bot/finance-bot-session
pm2 restart finance-bot-api
```

### Problema: Puppeteer não encontra Chrome

```bash
# Instale todas as dependências
apt install -y libgbm-dev libxshmfence-dev

# Ou especifique o caminho no código
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
```

### Problema: Permissões negadas

```bash
# Ajuste permissões
chown -R www-data:www-data /opt/whatsapp-finance-bot
chmod -R 755 /opt/whatsapp-finance-bot
chmod -R 777 /opt/whatsapp-finance-bot/uploads
chmod -R 777 /opt/whatsapp-finance-bot/data
```

### Problema: Memória insuficiente

```bash
# Adicione swap
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Verifique
free -h
```

### Problema: Porta 3000 em uso

```bash
# Encontre o processo
lsof -i :3000

# Mate o processo
kill -9 <PID>
```

---

## 📁 Estrutura Final no VPS

```
/opt/whatsapp-finance-bot/
├── src/                    # Código fonte
├── web/dist/              # Frontend buildado
├── uploads/               # Arquivos enviados
├── data/                  # Banco SQLite
├── logs/                  # Logs da aplicação
├── ecosystem.config.js    # Config PM2
├── .env                   # Variáveis de ambiente
├── deploy.sh              # Script de deploy
└── health-check.sh        # Script de health check
```

---

## 🌐 Domínios Recomendados

Configure seus DNS apontando para o IP do VPS:

| Subdomínio | Destino |
|------------|---------|
| `api.seudominio.com` | Backend API |
| `app.seudominio.com` | Painel Web |
| `bot.seudominio.com` | (opcional) |

---

## ✅ Checklist Final

- [ ] Node.js 20 instalado
- [ ] Chrome instalado
- [ ] PM2 configurado
- [ ] Nginx configurado
- [ ] SSL instalado
- [ ] Firewall ativo
- [ ] Aplicação rodando
- [ ] Logs configurados
- [ ] Health check ativo
- [ ] Backup configurado

---

## 📞 Comandos Rápidos

```bash
# Status geral
pm2 status
systemctl status nginx
ufw status

# Logs
pm2 logs
tail -f /var/log/nginx/error.log

# Restart
pm2 restart all
systemctl restart nginx

# Atualização
./deploy.sh
```

---

**Pronto! Seu bot está rodando em produção!** 🎉
