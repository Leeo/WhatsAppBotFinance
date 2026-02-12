# 🤖 Assistente de Gestão Financeira - Bot de WhatsApp

Sistema completo para controle de gastos pessoais via WhatsApp. Receba PDFs e imagens de faturas, recibos e notas fiscais, extraia os dados automaticamente via OCR e categorize os gastos.

## ✨ Funcionalidades

### 📱 Bot de WhatsApp
- **Processamento de Documentos**: Receba PDFs e imagens de notas fiscais
- **OCR Inteligente**: Extração automática de texto usando Tesseract.js
- **Parser Financeiro**: Identifica data, valor, estabelecimento e categoria
- **Categorização Automática**: Classifica em Alimentação, Transporte, Moradia, Lazer, Saúde ou Outros
- **Comandos de Consulta**: Resumos, listas e estatísticas via mensagens

### 🌐 Painel Web
- **Dashboard**: Visualize gastos por categoria com gráficos
- **Lista de Gastos**: Busque, filtre e gerencie transações
- **Upload Manual**: Envie documentos diretamente pelo painel
- **API REST**: Endpoints completos para integração

### 💾 Banco de Dados
- **SQLite**: Armazenamento local e seguro
- **Resumos**: Estatísticas por período e categoria
- **Filtros**: Consultas por data, usuário e categoria

---

## 🚀 Instalação

### Pré-requisitos
- Node.js 18+ 
- npm ou yarn
- Chrome/Chromium (para o bot)

### 1. Clone o repositório
```bash
cd whatsapp-finance-bot
```

### 2. Instale as dependências do backend
```bash
npm install
```

### 3. Instale as dependências do painel web
```bash
cd web
npm install
cd ..
```

### 4. Configure o ambiente
```bash
cp .env.example .env
# Edite o .env conforme necessário
```

### 5. Inicie o sistema
```bash
# Terminal 1 - Backend e Bot
npm start

# Terminal 2 - Painel Web (em outro terminal)
npm run web
```

---

## 📋 Comandos do Bot

Envie estas mensagens para o bot no WhatsApp:

| Comando | Descrição |
|---------|-----------|
| `!ajuda` | Mostra todos os comandos |
| `!gastos` | Resumo total de gastos |
| `!lista` | Lista os últimos 10 gastos |
| `!categorias` | Gastos agrupados por categoria |
| `!mes` | Resumo do mês atual |
| `!sobre` | Informações sobre o bot |

---

## 🔌 API Endpoints

### Gastos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/expenses` | Lista todos os gastos |
| GET | `/api/expenses/:id` | Busca gasto específico |
| POST | `/api/expenses` | Cria gasto manual |
| POST | `/api/expenses/upload` | Upload de documento |
| PUT | `/api/expenses/:id` | Atualiza gasto |
| DELETE | `/api/expenses/:id` | Remove gasto |

### Resumos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/expenses/summary` | Resumo de gastos |
| GET | `/api/expenses/stats/categories` | Estatísticas por categoria |

### Query Parameters

- `usuario`: Filtrar por usuário
- `categoria`: Filtrar por categoria
- `mes`: Filtrar por mês (01-12)
- `ano`: Filtrar por ano (YYYY)
- `dataInicio`: Data inicial (DD/MM/YYYY)
- `dataFim`: Data final (DD/MM/YYYY)

---

## 📁 Estrutura do Projeto

```
whatsapp-finance-bot/
├── src/
│   ├── bot/
│   │   └── whatsapp-bot.js      # Bot de WhatsApp (venom-bot)
│   ├── controllers/
│   │   └── expenseController.js # API REST
│   ├── database/
│   │   └── db.js                # SQLite e queries
│   ├── ocr/
│   │   └── documentProcessor.js # OCR e parser financeiro
│   └── index.js                 # Entry point
├── web/
│   └── src/
│       ├── components/          # Componentes React
│       ├── hooks/               # Hooks personalizados
│       └── App.tsx              # Aplicação principal
├── uploads/                     # Arquivos enviados
├── data/                        # Banco de dados SQLite
└── package.json
```

---

## 🎯 Formato de Saída

Quando um documento é processado, o bot retorna:

```json
{
  "data": "13/02/2026",
  "usuario": "João Silva",
  "estabelecimento": "Supermercado Extra",
  "valor": 156.78,
  "categoria": "Alimentação",
  "descricao_curta": "Compras do mês",
  "metodo_pagamento": "Crédito"
}
```

---

## 🔧 Configurações

### Variáveis de Ambiente (.env)

```env
NODE_ENV=development
PORT=3000
BOT_SESSION_NAME=finance-bot-session
BOT_HEADLESS=true
```

### Categorias Suportadas

- **Alimentação**: Restaurantes, mercados, padarias, delivery
- **Transporte**: Combustível, Uber, estacionamento, mecânica
- **Moradia**: Aluguel, contas, internet, streaming
- **Lazer**: Cinema, viagens, academia, eventos
- **Saúde**: Farmácia, médico, plano de saúde
- **Outros**: Demais gastos

---

## 🛠️ Tecnologias

### Backend
- **Node.js** + Express
- **venom-bot**: Automação do WhatsApp
- **Tesseract.js**: OCR para imagens
- **pdf-parse**: Extração de texto de PDFs
- **SQLite3**: Banco de dados
- **Sharp**: Processamento de imagens

### Frontend
- **React** + TypeScript
- **Vite**: Build tool
- **Tailwind CSS**: Estilos
- **shadcn/ui**: Componentes UI
- **Recharts**: Gráficos

---

## 📝 Licença

MIT License - Livre para uso e modificação.

---

## 🤝 Contribuição

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues e pull requests.

---

## 📧 Suporte

Em caso de dúvidas ou problemas, consulte a documentação ou entre em contato com o administrador.

---

**Desenvolvido com ❤️ para facilitar sua vida financeira!**
