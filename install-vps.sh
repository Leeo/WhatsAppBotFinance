#!/bin/bash

# 🚀 Script de Instalação Automática para VPS
# Assistente Financeiro - Bot de WhatsApp

set -e  # Para em caso de erro

echo "=========================================="
echo "  🚀 Instalador VPS - Finance Bot"
echo "=========================================="
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Funções
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_info() {
    echo -e "${YELLOW}[→]${NC} $1"
}

# Verificar se é root
if [ "$EUID" -ne 0 ]; then 
    print_error "Por favor, execute como root (sudo)"
    exit 1
fi

# Perguntar domínio
read -p "Digite seu domínio (ex: bot.seusite.com): " DOMAIN

if [ -z "$DOMAIN" ]; then
    print_error "Domínio é obrigatório"
    exit 1
fi

APP_DIR="/opt/whatsapp-finance-bot"

echo ""
print_info "Iniciando instalação em: $APP_DIR"
echo ""

# 1. Atualizar sistema
print_info "Atualizando sistema..."
apt update && apt upgrade -y
print_status "Sistema atualizado"

# 2. Instalar dependências básicas
print_info "Instalando dependências..."
apt install -y curl wget git nginx ufw software-properties-common apt-transport-https ca-certificates gnupg2
print_status "Dependências instaladas"

# 3. Instalar Node.js 20
print_info "Instalando Node.js 20..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi
print_status "Node.js $(node -v) instalado"

# 4. Instalar PM2
print_info "Instalando PM2..."
npm install -g pm2 serve
print_status "PM2 instalado"

# 5. Instalar Chrome
print_info "Instalando Google Chrome..."
if ! command -v google-chrome &> /dev/null; then
    wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -
    echo "deb http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list
    apt update
    apt install -y google-chrome-stable libgbm-dev libxshmfence-dev
fi
print_status "Chrome instalado: $(google-chrome --version)"

# 6. Criar diretório da aplicação
print_info "Criando diretórios..."
mkdir -p $APP_DIR
mkdir -p $APP_DIR/uploads/pdfs
mkdir -p $APP_DIR/uploads/images
mkdir -p $APP_DIR/data
mkdir -p $APP_DIR/logs
mkdir -p /var/www/certbot
print_status "Diretórios criados"

# 7. Configurar permissões
print_info "Configurando permissões..."
chown -R www-data:www-data $APP_DIR
chmod -R 755 $APP_DIR
chmod -R 777 $APP_DIR/uploads
chmod -R 777 $APP_DIR/data
print_status "Permissões configuradas"

# 8. Configurar Firewall
print_info "Configurando firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
print_status "Firewall configurado"

# 9. Configurar Nginx
print_info "Configurando Nginx..."
cat > /etc/nginx/sites-available/whatsapp-finance-bot << 'EOF'
server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
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
    }
}
EOF

sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" /etc/nginx/sites-available/whatsapp-finance-bot

ln -sf /etc/nginx/sites-available/whatsapp-finance-bot /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

nginx -t && systemctl reload nginx
print_status "Nginx configurado"

# 10. Instalar Certbot
print_info "Instalando Certbot..."
apt install -y certbot python3-certbot-nginx
print_status "Certbot instalado"

# 11. Criar arquivo .env
print_info "Criando arquivo de configuração..."
cat > $APP_DIR/.env << EOF
NODE_ENV=production
PORT=3000
BOT_SESSION_NAME=finance-bot-session
BOT_HEADLESS=true
UPLOAD_DIR=./uploads
DATA_DIR=./data
OCR_LANGUAGE=por
OCR_PSM=6
EOF
print_status "Configuração criada"

# 12. Criar ecosystem.config.js
print_info "Criando configuração do PM2..."
cat > $APP_DIR/ecosystem.config.js << 'EOF'
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
      watch: false
    }
  ]
};
EOF
print_status "PM2 configurado"

# 13. Criar script de health check
print_info "Criando health check..."
cat > $APP_DIR/health-check.sh << 'EOF'
#!/bin/bash
API_URL="http://localhost:3000/health"
LOG_FILE="/opt/whatsapp-finance-bot/logs/health-check.log"

response=$(curl -s -o /dev/null -w "%{http_code}" $API_URL)

if [ $response -ne 200 ]; then
    echo "$(date): API retornou $response - Reiniciando..." >> $LOG_FILE
    pm2 restart finance-bot-api
else
    echo "$(date): API OK" >> $LOG_FILE
fi
EOF
chmod +x $APP_DIR/health-check.sh
print_status "Health check criado"

# 14. Configurar cron
print_info "Configurando cron jobs..."
(crontab -l 2>/dev/null; echo "*/5 * * * * /opt/whatsapp-finance-bot/health-check.sh") | crontab -
print_status "Cron configurado"

# 15. Criar swap (se necessário)
if [ ! -f /swapfile ]; then
    print_info "Criando swap..."
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    print_status "Swap criado"
fi

echo ""
echo "=========================================="
echo "  ✅ Instalação Base Concluída!"
echo "=========================================="
echo ""
echo "📋 Próximos passos:"
echo ""
echo "1. 📤 Faça upload do código para:"
echo "   $APP_DIR"
echo ""
echo "2. 📦 Instale as dependências:"
echo "   cd $APP_DIR"
echo "   npm install"
echo ""
echo "3. 🌐 Configure o SSL:"
echo "   certbot --nginx -d $DOMAIN"
echo ""
echo "4. 🚀 Inicie a aplicação:"
echo "   pm2 start ecosystem.config.js"
echo "   pm2 save"
echo "   pm2 startup systemd"
echo ""
echo "5. 📱 Escaneie o QR Code que aparecerá nos logs:"
echo "   pm2 logs"
echo ""
echo "📊 Acesse: http://$DOMAIN"
echo ""
echo "=========================================="
