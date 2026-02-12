# 🐳 Deploy com Docker - Assistente Financeiro

Guia para rodar o bot usando Docker e Docker Compose.

---

## 📋 Requisitos

- Docker 20.10+
- Docker Compose 2.0+
- 4GB RAM mínimo
- 20GB disco

---

## 🚀 Instalação Rápida

### 1. Instale o Docker

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com | sh

# Ou manualmente
apt update
apt install -y docker.io docker-compose-plugin

# Inicie o Docker
systemctl enable docker
systemctl start docker
```

### 2. Clone o projeto

```bash
cd /opt
git clone https://github.com/seu-usuario/whatsapp-finance-bot.git
cd whatsapp-finance-bot
```

### 3. Configure o ambiente

```bash
cp .env.example .env
nano .env
```

```env
NODE_ENV=production
PORT=3000
BOT_SESSION_NAME=finance-bot-session
BOT_HEADLESS=true
```

### 4. Crie as pastas necessárias

```bash
mkdir -p data uploads logs certbot/conf certbot/www
chmod -R 777 data uploads logs
```

### 5. Inicie os containers

```bash
docker-compose up -d
```

### 6. Verifique os logs

```bash
# Logs do bot
docker-compose logs -f api

# Todos os logs
docker-compose logs -f
```

---

## 📱 Configurando o WhatsApp

Na primeira execução, o bot mostrará um QR Code nos logs:

```bash
docker-compose logs -f api
```

Você verá algo como:
```
🤖 Inicializando bot do WhatsApp...
⏳ Aguarde, isso pode levar alguns segundos...
📱 QR Code gerado! Escaneie com seu WhatsApp:
[QR CODE AQUI]
```

1. Abra o WhatsApp no celular
2. Configurações → Dispositivos Conectados
3. Conectar dispositivo
4. Escaneie o QR Code

---

## 🌐 Configurando Domínio e SSL

### 1. Configure seu DNS

Aponte seu domínio para o IP do servidor:
- `A` record: `bot.seusite.com` → `SEU_IP`

### 2. Configure o Nginx

Crie o arquivo `nginx/sites-available/default`:

```bash
mkdir -p nginx/sites-available
```

```nginx
server {
    listen 80;
    server_name bot.seusite.com;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name bot.seusite.com;
    
    ssl_certificate /etc/letsencrypt/live/bot.seusite.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bot.seusite.com/privkey.pem;
    
    # Frontend
    location / {
        proxy_pass http://web:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # API
    location /api/ {
        proxy_pass http://api:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 3. Obtenha o certificado SSL

```bash
# Pare os containers temporariamente
docker-compose down

# Obtenha o certificado
docker run -it --rm \
  -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
  -v "$(pwd)/certbot/www:/var/www/certbot" \
  -p 80:80 \
  certbot/certbot certonly \
  --standalone \
  -d bot.seusite.com \
  --agree-tos \
  -m seu-email@exemplo.com

# Inicie novamente
docker-compose up -d
```

---

## 🔧 Comandos Úteis

```bash
# Ver status
docker-compose ps

# Ver logs
docker-compose logs -f [api|web|nginx]

# Reiniciar
docker-compose restart

# Parar
docker-compose down

# Rebuild (após alterações no código)
docker-compose up -d --build

# Acessar container
docker-compose exec api bash
docker-compose exec web sh

# Ver recursos
docker stats

# Backup do banco
docker-compose exec api cp /app/data/expenses.db /app/data/expenses.db.backup
```

---

## 💾 Backup e Restore

### Backup

```bash
#!/bin/bash
BACKUP_DIR="/backups/whatsapp-finance-bot"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup do banco
docker-compose exec -T api cat /app/data/expenses.db > $BACKUP_DIR/expenses_$DATE.db

# Backup dos uploads
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz uploads/

# Backup das configurações
tar -czf $BACKUP_DIR/config_$DATE.tar.gz .env docker-compose.yml nginx/

echo "Backup concluído: $BACKUP_DIR"
```

### Restore

```bash
# Pare os containers
docker-compose down

# Restaure o banco
cp /backups/whatsapp-finance-bot/expenses_20240213_120000.db data/expenses.db

# Restaure os uploads
tar -xzf /backups/whatsapp-finance-bot/uploads_20240213_120000.tar.gz

# Inicie
docker-compose up -d
```

---

## 📊 Monitoramento

### Health Check

O Docker Compose já inclui health checks. Verifique:

```bash
docker-compose ps
```

### Logs centralizados

```bash
# Todas as logs
docker-compose logs -f --tail=100

# Somente erros
docker-compose logs -f api | grep ERROR
```

### Auto-restart

Os containers estão configurados com `restart: unless-stopped`, ou seja, eles reiniciam automaticamente em caso de falha.

---

## 🔄 Atualização

```bash
# Pare os containers
docker-compose down

# Atualize o código
git pull origin main

# Rebuild e reinicie
docker-compose up -d --build

# Verifique
docker-compose ps
docker-compose logs -f api
```

---

## 🐛 Troubleshooting

### Container não inicia

```bash
# Verifique os logs
docker-compose logs api

# Verifique se as portas estão livres
netstat -tlnp | grep 3000

# Pare e remova tudo
docker-compose down -v
docker-compose up -d
```

### QR Code não aparece

```bash
# Acesse o container
docker-compose exec api bash

# Delete a sessão e reinicie
rm -rf /app/tokens/*
exit

# Reinicie
docker-compose restart api

# Veja os logs
docker-compose logs -f api
```

### Permissões negadas

```bash
# Ajuste permissões
chmod -R 777 data uploads logs certbot

# Ou mude o usuário no docker-compose
# user: "1000:1000"
```

### Memória insuficiente

```bash
# Adicione swap
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
```

---

## 🎯 Vantagens do Docker

| Vantagem | Descrição |
|----------|-----------|
| **Isolamento** | Cada serviço roda em seu próprio container |
| **Portabilidade** | Funciona em qualquer servidor com Docker |
| **Fácil backup** | Volumes são fáceis de fazer backup |
| **Rollback** | Volte para versões anteriores facilmente |
| **Escalabilidade** | Escale horizontalmente se necessário |

---

## 📁 Estrutura de Arquivos

```
whatsapp-finance-bot/
├── docker-compose.yml      # Configuração dos serviços
├── Dockerfile              # Backend
├── web/
│   └── Dockerfile          # Frontend
├── nginx/
│   └── sites-available/    # Configurações do nginx
├── data/                   # Banco SQLite (volume)
├── uploads/                # Arquivos enviados (volume)
├── logs/                   # Logs da aplicação (volume)
└── certbot/                # Certificados SSL (volume)
```

---

## ✅ Checklist Docker

- [ ] Docker instalado
- [ ] Docker Compose instalado
- [ ] Projeto clonado
- [ ] .env configurado
- [ ] Pastas criadas
- [ ] Containers rodando
- [ ] QR Code escaneado
- [ ] Domínio configurado
- [ ] SSL instalado
- [ ] Backup configurado

---

**Pronto! Seu bot está rodando com Docker!** 🐳🎉
