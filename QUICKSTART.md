# 🚀 Quick Start - Assistente Financeiro

## Instalação Rápida

### 1. Instalar dependências
```bash
# Backend
cd whatsapp-finance-bot
npm install

# Frontend
cd web
npm install
cd ..
```

### 2. Configurar ambiente
```bash
cp .env.example .env
```

### 3. Iniciar o sistema

**Terminal 1 - Backend:**
```bash
npm start
```

**Terminal 2 - Frontend:**
```bash
npm run web
```

---

## 📱 Usando o Bot

1. **Escaneie o QR Code** que aparece no terminal
2. **Envie uma foto** de uma nota fiscal ou recibo
3. **O bot extrai automaticamente:**
   - Data
   - Valor
   - Estabelecimento
   - Categoria

### Comandos disponíveis:
- `!ajuda` - Lista todos os comandos
- `!gastos` - Resumo total
- `!lista` - Últimos gastos
- `!categorias` - Por categoria
- `!mes` - Resumo do mês

---

## 🌐 Acessando o Painel

Abra no navegador: **http://localhost:5173**

Funcionalidades:
- 📊 Dashboard com gráficos
- 📝 Lista completa de gastos
- 📤 Upload de documentos
- 🔍 Filtros e busca

---

## 🔌 API Endpoints

Base URL: `http://localhost:3000`

| Endpoint | Descrição |
|----------|-----------|
| `GET /api/expenses` | Lista gastos |
| `POST /api/expenses` | Cria gasto |
| `POST /api/expenses/upload` | Upload de documento |
| `GET /api/expenses/summary` | Resumo |

---

## ⚠️ Primeira Execução

Na primeira vez, o bot mostrará um **QR Code** no terminal:

1. Abra o WhatsApp no celular
2. Vá em **Configurações > Dispositivos Conectados**
3. Toque em **Conectar dispositivo**
4. Escaneie o QR Code

Pronto! O bot está conectado! 🎉

---

## 🛠️ Solução de Problemas

### Erro de Puppeteer/Chrome
```bash
# Instale as dependências do Chrome
sudo apt-get install -y chromium-browser
```

### Erro de permissões
```bash
# Dê permissões às pastas
chmod -R 755 uploads data
```

### Bot não conecta
- Verifique sua conexão com internet
- Certifique-se de que o WhatsApp Web funciona no navegador
- Delete a pasta `finance-bot-session` e tente novamente

---

## 📁 Estrutura de Pastas

```
whatsapp-finance-bot/
├── src/              # Código do backend
├── web/src/          # Código do frontend
├── uploads/          # Arquivos enviados
├── data/             # Banco de dados
└── README.md         # Documentação completa
```

---

**Pronto para usar!** 🎉

Para mais detalhes, consulte o [README.md](./README.md)
