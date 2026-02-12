/**
 * 🤖 BOT DE WHATSAPP - GESTÃO FINANCEIRA
 * 
 * Sistema completo para extração de dados de gastos via WhatsApp
 * Recebe PDFs e imagens de faturas/recibos e extrai informações financeiras
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');

const { initializeBot } = require('./bot/whatsapp-bot');
const { initializeDatabase } = require('./database/db');
const expenseRoutes = require('./controllers/expenseController');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Garantir que as pastas existam
fs.ensureDirSync(path.join(__dirname, '../uploads'));
fs.ensureDirSync(path.join(__dirname, '../uploads/pdfs'));
fs.ensureDirSync(path.join(__dirname, '../uploads/images'));

// Rotas da API
app.use('/api/expenses', expenseRoutes);

// Rota de saúde
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'WhatsApp Finance Bot'
  });
});

// Inicialização do sistema
async function startSystem() {
  try {
    console.log('🚀 Inicializando Sistema de Gestão Financeira...\n');
    
    // 1. Inicializar banco de dados
    console.log('📦 Inicializando banco de dados...');
    await initializeDatabase();
    console.log('✅ Banco de dados pronto!\n');
    
    // 2. Iniciar servidor Express
    app.listen(PORT, () => {
      console.log(`🌐 Servidor API rodando na porta ${PORT}`);
      console.log(`📊 Painel web: http://localhost:${PORT}`);
      console.log(`🔍 Health check: http://localhost:${PORT}/health\n`);
    });
    
    // 3. Inicializar bot do WhatsApp
    console.log('🤖 Inicializando bot do WhatsApp...');
    console.log('⏳ Aguarde, isso pode levar alguns segundos...\n');
    await initializeBot();
    
  } catch (error) {
    console.error('❌ Erro ao inicializar sistema:', error);
    process.exit(1);
  }
}

// Tratamento de erros não capturados
process.on('uncaughtException', (err) => {
  console.error('❌ Erro não capturado:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Promise rejeitada:', err);
});

// Iniciar
startSystem();
