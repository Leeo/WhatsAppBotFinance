/**
 * 🤖 MÓDULO DO BOT DE WHATSAPP
 * 
 * Gerencia conexão, recebimento de mensagens e processamento de documentos
 */

const venom = require('venom-bot');
const path = require('path');
const fs = require('fs-extra');
const { processDocument, extractFinancialData } = require('../ocr/documentProcessor');
const { addExpense, getAllExpenses, getExpenseSummary } = require('../database/db');

let client = null;
const userSessions = new Map();

/**
 * Inicializa o bot do WhatsApp
 */
async function initializeBot() {
  try {
    client = await venom.create({
      session: 'finance-bot-session',
      headless: true,
      useChrome: false,
      browserArgs: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ],
      puppeteerOptions: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });

    console.log('✅ Bot do WhatsApp conectado com sucesso!\n');
    console.log('📱 QR Code escaneado - Bot pronto para uso!\n');

    // Configurar listeners de eventos
    setupEventListeners();

    return client;
  } catch (error) {
    console.error('❌ Erro ao inicializar bot:', error);
    throw error;
  }
}

/**
 * Configura os listeners de eventos do bot
 */
function setupEventListeners() {
  // Listener de mensagens
  client.onMessage(async (message) => {
    try {
      await handleMessage(message);
    } catch (error) {
      console.error('❌ Erro ao processar mensagem:', error);
    }
  });

  // Listener de estado
  client.onStateChange((state) => {
    console.log('🔄 Estado do bot alterado:', state);
  });

  // Listener de QR Code (para reconexão)
  client.onQr((qr) => {
    console.log('📱 Novo QR Code gerado para reconexão');
  });
}

/**
 * Processa mensagens recebidas
 */
async function handleMessage(message) {
  const chatId = message.from;
  const userName = message.notifyName || message.pushname || 'Usuário';
  const text = message.body || '';
  const lowerText = text.toLowerCase().trim();

  console.log(`\n📩 Mensagem recebida de ${userName}: ${text.substring(0, 50)}...`);

  // Verificar se é um comando
  if (lowerText.startsWith('!') || lowerText.startsWith('/')) {
    await handleCommand(chatId, lowerText, userName);
    return;
  }

  // Verificar se é um documento (PDF ou imagem)
  if (message.isMedia || message.type === 'document' || message.mimetype) {
    await handleDocument(message, userName);
    return;
  }

  // Mensagem de ajuda padrão
  await sendHelpMessage(chatId);
}

/**
 * Processa comandos
 */
async function handleCommand(chatId, command, userName) {
  console.log(`⚙️ Comando recebido: ${command}`);

  switch (command) {
    case '!ajuda':
    case '!help':
    case '/ajuda':
      await sendHelpMessage(chatId);
      break;

    case '!gastos':
    case '!total':
    case '/gastos':
      await sendExpensesSummary(chatId, userName);
      break;

    case '!lista':
    case '!listar':
    case '/lista':
      await sendExpensesList(chatId, userName, 10);
      break;

    case '!categorias':
    case '!categoria':
    case '/categorias':
      await sendCategoriesSummary(chatId, userName);
      break;

    case '!mes':
    case '!mês':
    case '/mes':
      await sendMonthlySummary(chatId, userName);
      break;

    case '!apagar':
    case '!delete':
    case '/apagar':
      await client.sendText(chatId, 
        '❓ Para apagar um gasto, use:\n' +
        '!apagar [ID]\n\n' +
        'Exemplo: !apagar 5'
      );
      break;

    case '!sobre':
    case '!info':
    case '/sobre':
      await sendAboutMessage(chatId);
      break;

    default:
      if (command.startsWith('!apagar ') || command.startsWith('/apagar ')) {
        // TODO: Implementar exclusão
        await client.sendText(chatId, '⚠️ Função de exclusão em desenvolvimento');
      } else {
        await client.sendText(chatId, 
          '❓ Comando não reconhecido.\n' +
          'Digite !ajuda para ver os comandos disponíveis.'
        );
      }
  }
}

/**
 * Processa documentos (PDFs e imagens)
 */
async function handleDocument(message, userName) {
  const chatId = message.from;
  
  // Verificar se é um tipo de arquivo suportado
  const mimeType = message.mimetype || '';
  const isPDF = mimeType.includes('pdf');
  const isImage = mimeType.includes('image');
  
  if (!isPDF && !isImage) {
    await client.sendText(chatId, 
      '⚠️ Tipo de arquivo não suportado.\n' +
      'Envie apenas PDFs ou imagens (JPG, PNG) de faturas e recibos.'
    );
    return;
  }

  try {
    // Informar que está processando
    await client.sendText(chatId, '📄 Processando documento... Aguarde um momento.');

    // Baixar o arquivo
    const buffer = await client.decryptFile(message);
    const extension = isPDF ? '.pdf' : path.extname(message.filename || '.jpg');
    const fileName = `doc_${Date.now()}${extension}`;
    const subDir = isPDF ? 'pdfs' : 'images';
    const filePath = path.join(__dirname, '../../uploads', subDir, fileName);

    await fs.writeFile(filePath, buffer);
    console.log(`💾 Arquivo salvo: ${filePath}`);

    // Processar documento com OCR
    const result = await processDocument(filePath);

    if (!result.success) {
      await client.sendText(chatId, 
        '❌ Não foi possível processar o documento.\n' +
        'Erro: ' + result.error
      );
      return;
    }

    // Extrair dados financeiros
    const expenseData = extractFinancialData(result.text, userName);

    // Validar dados extraídos
    if (expenseData.valor === 0) {
      await client.sendText(chatId, 
        '⚠️ Não consegui identificar o valor no documento.\n' +
        'Por favor, envie uma imagem mais nítida ou digite os dados manualmente.'
      );
      return;
    }

    // Salvar no banco de dados
    const savedExpense = await addExpense(expenseData);

    // Enviar confirmação
    await sendExpenseConfirmation(chatId, savedExpense);

    // Limpar arquivo temporário (opcional - manter para debug)
    // await fs.remove(filePath);

  } catch (error) {
    console.error('❌ Erro ao processar documento:', error);
    await client.sendText(chatId, 
      '❌ Erro ao processar o documento.\n' +
      'Por favor, tente novamente ou envie os dados manualmente.'
    );
  }
}

/**
 * Envia confirmação do gasto registrado
 */
async function sendExpenseConfirmation(chatId, expense) {
  const message = 
    '✅ *Gasto registrado com sucesso!*\n\n' +
    `📅 *Data:* ${expense.data}\n` +
    `🏪 *Estabelecimento:* ${expense.estabelecimento}\n` +
    `💰 *Valor:* R$ ${expense.valor.toFixed(2)}\n` +
    `📂 *Categoria:* ${expense.categoria}\n` +
    `📝 *Descrição:* ${expense.descricao_curta}\n` +
    (expense.metodo_pagamento ? `💳 *Pagamento:* ${expense.metodo_pagamento}\n` : '') +
    `\n🆔 *ID:* ${expense.id}`;

  await client.sendText(chatId, message);
}

/**
 * Envia resumo de gastos
 */
async function sendExpensesSummary(chatId, userName) {
  try {
    const summary = await getExpenseSummary({ usuario: userName });

    if (summary.total_transacoes === 0) {
      await client.sendText(chatId, 
        '📊 *Resumo de Gastos*\n\n' +
        'Nenhum gasto registrado ainda.\n' +
        'Envie uma foto de uma nota fiscal ou recibo para começar!'
      );
      return;
    }

    const message = 
      '📊 *Resumo de Gastos*\n\n' +
      `👤 *Usuário:* ${userName}\n` +
      `📈 *Total de transações:* ${summary.total_transacoes}\n` +
      `💰 *Total gasto:* R$ ${summary.total_gasto.toFixed(2)}\n` +
      `📊 *Média por gasto:* R$ ${summary.media_gasto.toFixed(2)}\n` +
      `🔺 *Maior gasto:* R$ ${summary.maior_gasto.toFixed(2)}\n` +
      `🔻 *Menor gasto:* R$ ${summary.menor_gasto.toFixed(2)}\n\n` +
      '📋 *Gastos por categoria:*\n';

    let categoriasMsg = '';
    summary.por_categoria.forEach(cat => {
      categoriasMsg += `  • ${cat.categoria}: R$ ${cat.total.toFixed(2)} (${cat.quantidade}x)\n`;
    });

    await client.sendText(chatId, message + categoriasMsg);

  } catch (error) {
    console.error('❌ Erro ao buscar resumo:', error);
    await client.sendText(chatId, '❌ Erro ao buscar resumo de gastos.');
  }
}

/**
 * Envia lista de gastos recentes
 */
async function sendExpensesList(chatId, userName, limit = 10) {
  try {
    const expenses = await getAllExpenses({ usuario: userName });
    const recentExpenses = expenses.slice(0, limit);

    if (recentExpenses.length === 0) {
      await client.sendText(chatId, 
        '📋 *Últimos Gastos*\n\n' +
        'Nenhum gasto registrado ainda.'
      );
      return;
    }

    let message = `📋 *Últimos ${recentExpenses.length} Gastos*\n\n`;

    recentExpenses.forEach((exp, index) => {
      message += 
        `${index + 1}. *${exp.estabelecimento}*\n` +
        `   💰 R$ ${exp.valor.toFixed(2)} - ${exp.data}\n` +
        `   📂 ${exp.categoria} (ID: ${exp.id})\n\n`;
    });

    message += `Total: ${expenses.length} gastos registrados`;

    await client.sendText(chatId, message);

  } catch (error) {
    console.error('❌ Erro ao listar gastos:', error);
    await client.sendText(chatId, '❌ Erro ao listar gastos.');
  }
}

/**
 * Envia resumo por categorias
 */
async function sendCategoriesSummary(chatId, userName) {
  try {
    const summary = await getExpenseSummary({ usuario: userName });

    if (summary.por_categoria.length === 0) {
      await client.sendText(chatId, '⚠️ Nenhum gasto registrado ainda.');
      return;
    }

    let message = '📂 *Gastos por Categoria*\n\n';

    summary.por_categoria.forEach((cat, index) => {
      const percentual = ((cat.total / summary.total_gasto) * 100).toFixed(1);
      message += 
        `${index + 1}. *${cat.categoria}*\n` +
        `   💰 R$ ${cat.total.toFixed(2)} (${percentual}%)\n` +
        `   📊 ${cat.quantidade} transações\n\n`;
    });

    message += `💰 *Total:* R$ ${summary.total_gasto.toFixed(2)}`;

    await client.sendText(chatId, message);

  } catch (error) {
    console.error('❌ Erro ao buscar categorias:', error);
    await client.sendText(chatId, '❌ Erro ao buscar resumo por categorias.');
  }
}

/**
 * Envia resumo mensal
 */
async function sendMonthlySummary(chatId, userName) {
  try {
    const now = new Date();
    const mes = String(now.getMonth() + 1).padStart(2, '0');
    const ano = now.getFullYear();
    
    const summary = await getExpenseSummary({ usuario: userName, mes, ano });

    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    if (summary.total_transacoes === 0) {
      await client.sendText(chatId, 
        `📅 *Gastos de ${meses[now.getMonth()]} ${ano}*\n\n` +
        'Nenhum gasto registrado neste mês.'
      );
      return;
    }

    let message = 
      `📅 *Gastos de ${meses[now.getMonth()]} ${ano}*\n\n` +
      `📈 *Transações:* ${summary.total_transacoes}\n` +
      `💰 *Total:* R$ ${summary.total_gasto.toFixed(2)}\n` +
      `📊 *Média:* R$ ${summary.media_gasto.toFixed(2)}\n\n` +
      '*Por categoria:*\n';

    summary.por_categoria.forEach(cat => {
      message += `  • ${cat.categoria}: R$ ${cat.total.toFixed(2)}\n`;
    });

    await client.sendText(chatId, message);

  } catch (error) {
    console.error('❌ Erro ao buscar resumo mensal:', error);
    await client.sendText(chatId, '❌ Erro ao buscar resumo mensal.');
  }
}

/**
 * Envia mensagem de ajuda
 */
async function sendHelpMessage(chatId) {
  const message = 
    '🤖 *Assistente de Gestão Financeira*\n\n' +
    '*Como usar:*\n' +
    'Envie uma foto ou PDF de uma nota fiscal, recibo ou fatura que eu extraio os dados automaticamente!\n\n' +
    '*Comandos disponíveis:*\n' +
    '• !ajuda - Mostra esta mensagem\n' +
    '• !gastos - Resumo total de gastos\n' +
    '• !lista - Lista os últimos 10 gastos\n' +
    '• !categorias - Gastos agrupados por categoria\n' +
    '• !mes - Resumo do mês atual\n' +
    '• !sobre - Informações sobre o bot\n\n' +
    '*Categorias automáticas:*\n' +
    'Alimentação, Transporte, Moradia, Lazer, Saúde, Outros\n\n' +
    '💡 *Dica:* Quanto mais nítida a imagem, melhor a extração dos dados!';

  await client.sendText(chatId, message);
}

/**
 * Envia mensagem sobre o bot
 */
async function sendAboutMessage(chatId) {
  const message = 
    '🤖 *Assistente de Gestão Financeira*\n\n' +
    'Versão: 1.0.0\n' +
    'Desenvolvido para ajudar no controle de gastos pessoais\n\n' +
    '*Funcionalidades:*\n' +
    '✅ Extração automática de dados de faturas\n' +
    '✅ OCR para imagens e PDFs\n' +
    '✅ Categorização inteligente\n' +
    '✅ Relatórios e resumos\n' +
    '✅ Banco de dados local seguro\n\n' +
    '📧 Suporte: Contate o administrador';

  await client.sendText(chatId, message);
}

/**
 * Envia mensagem para um chat
 */
async function sendMessage(chatId, message) {
  if (client) {
    return await client.sendText(chatId, message);
  }
  throw new Error('Bot não inicializado');
}

/**
 * Obtém o cliente do bot
 */
function getClient() {
  return client;
}

module.exports = {
  initializeBot,
  sendMessage,
  getClient,
  handleMessage
};
