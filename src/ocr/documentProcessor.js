/**
 * 🔍 MÓDULO DE OCR - PROCESSAMENTO DE DOCUMENTOS
 * 
 * Extrai texto de PDFs e imagens para análise de gastos
 */

const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const fs = require('fs-extra');
const path = require('path');

/**
 * Processa um arquivo PDF e extrai o texto
 */
async function extractFromPDF(filePath) {
  try {
    console.log(`📄 Processando PDF: ${path.basename(filePath)}`);
    
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParse(dataBuffer);
    
    console.log(`✅ PDF processado - ${data.text.length} caracteres extraídos`);
    
    return {
      success: true,
      text: data.text,
      pages: data.numpages,
      info: data.info
    };
  } catch (error) {
    console.error('❌ Erro ao processar PDF:', error);
    return {
      success: false,
      error: error.message,
      text: ''
    };
  }
}

/**
 * Processa uma imagem e extrai texto via OCR
 */
async function extractFromImage(filePath) {
  try {
    console.log(`🖼️ Processando imagem: ${path.basename(filePath)}`);
    
    // Pré-processar imagem para melhorar OCR
    const processedPath = await preprocessImage(filePath);
    
    // Executar OCR
    const result = await Tesseract.recognize(
      processedPath,
      'por', // Português
      {
        logger: m => {
          if (m.status === 'recognizing text') {
            process.stdout.write(`\r📝 OCR: ${Math.round(m.progress * 100)}%`);
          }
        }
      }
    );
    
    console.log('\n✅ OCR concluído');
    
    // Limpar arquivo temporário
    if (processedPath !== filePath) {
      await fs.remove(processedPath).catch(() => {});
    }
    
    return {
      success: true,
      text: result.data.text,
      confidence: result.data.confidence,
      words: result.data.words.length
    };
  } catch (error) {
    console.error('❌ Erro no OCR:', error);
    return {
      success: false,
      error: error.message,
      text: ''
    };
  }
}

/**
 * Pré-processa imagem para melhorar qualidade do OCR
 */
async function preprocessImage(filePath) {
  try {
    const ext = path.extname(filePath);
    const tempPath = filePath.replace(ext, `_processed${ext}`);
    
    await sharp(filePath)
      .resize(2000, 2000, { fit: 'inside', withoutEnlargement: false })
      .grayscale()
      .normalize()
      .sharpen({ sigma: 1, flat: 1, jagged: 2 })
      .toFile(tempPath);
    
    return tempPath;
  } catch (error) {
    console.warn('⚠️ Erro no pré-processamento, usando imagem original:', error.message);
    return filePath;
  }
}

/**
 * Detecta o tipo de arquivo e processa adequadamente
 */
async function processDocument(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.pdf') {
    return await extractFromPDF(filePath);
  } else if (['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp'].includes(ext)) {
    return await extractFromImage(filePath);
  } else {
    return {
      success: false,
      error: `Formato de arquivo não suportado: ${ext}`,
      text: ''
    };
  }
}

/**
 * Extrai dados financeiros do texto usando regex e parsers
 */
function extractFinancialData(text, usuario = 'Desconhecido') {
  console.log('🔍 Extraindo dados financeiros do texto...');
  
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  
  // Extrair data
  const data = extractDate(text);
  
  // Extrair valor
  const valor = extractValue(text);
  
  // Extrair estabelecimento
  const estabelecimento = extractEstablishment(text, lines);
  
  // Extrair descrição
  const descricao = extractDescription(text, lines);
  
  // Categorizar
  const categoria = categorizeExpense(estabelecimento, descricao, text);
  
  // Extrair método de pagamento
  const metodoPagamento = extractPaymentMethod(text);
  
  return {
    data,
    usuario,
    estabelecimento,
    valor,
    categoria,
    descricao_curta: descricao,
    metodo_pagamento: metodoPagamento,
    texto_original: text.substring(0, 500) // Primeiros 500 caracteres para referência
  };
}

/**
 * Extrai data do texto
 */
function extractDate(text) {
  // Padrões comuns de data no Brasil
  const patterns = [
    // DD/MM/YYYY ou DD-MM-YYYY
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/g,
    // DD de Mês de YYYY
    /(\d{1,2})\s+de\s+(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})/gi,
    // YYYY-MM-DD (ISO)
    /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/g
  ];
  
  const meses = {
    'janeiro': '01', 'fevereiro': '02', 'março': '03', 'abril': '04',
    'maio': '05', 'junho': '06', 'julho': '07', 'agosto': '08',
    'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12'
  };
  
  for (const pattern of patterns) {
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) {
      let dia, mes, ano;
      
      if (match[0].toLowerCase().includes('de')) {
        // Formato: DD de Mês de YYYY
        dia = match[1].padStart(2, '0');
        mes = meses[match[2].toLowerCase()];
        ano = match[3];
      } else if (match[1].length === 4) {
        // Formato: YYYY-MM-DD
        ano = match[1];
        mes = match[2].padStart(2, '0');
        dia = match[3].padStart(2, '0');
      } else {
        // Formato: DD/MM/YYYY
        dia = match[1].padStart(2, '0');
        mes = match[2].padStart(2, '0');
        ano = match[3].length === 2 ? '20' + match[3] : match[3];
      }
      
      // Validar data
      const data = new Date(`${ano}-${mes}-${dia}`);
      if (data.getFullYear() >= 2020 && data.getFullYear() <= 2030) {
        return `${dia}/${mes}/${ano}`;
      }
    }
  }
  
  // Data atual como fallback
  const hoje = new Date();
  return `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`;
}

/**
 * Extrai valor monetário do texto
 */
function extractValue(text) {
  // Padrões de valor em reais
  const patterns = [
    // R$ 1.234,56 ou R$ 1234,56
    /R?\$\s*([\d.]+),?(\d{2})/gi,
    // VALOR TOTAL: 1.234,56
    /(?:valor\s+total|total|valor\s+a\s+pagar|valor\s+pago)[\s:]*R?\$?\s*([\d.]+),?(\d{2})/gi,
    // 1.234,56 (números com vírgula decimal)
    /(\d{1,3}(?:\.\d{3})+,\d{2})/g,
    // 1234,56
    /(\d+,\d{2})/g
  ];
  
  let valores = [];
  
  for (const pattern of patterns) {
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) {
      let valorStr = match[1] || match[0];
      // Limpar e converter
      valorStr = valorStr.replace(/R?\$\s*/i, '').replace(/\./g, '').replace(',', '.');
      const valor = parseFloat(valorStr);
      
      if (!isNaN(valor) && valor > 0 && valor < 100000) {
        valores.push({
          valor,
          texto: match[0],
          index: match.index
        });
      }
    }
  }
  
  // Ordenar por valor (maior primeiro, geralmente é o total)
  valores.sort((a, b) => b.valor - a.valor);
  
  // Retornar o maior valor (provavelmente o total)
  if (valores.length > 0) {
    return parseFloat(valores[0].valor.toFixed(2));
  }
  
  return 0.00;
}

/**
 * Extrai nome do estabelecimento
 */
function extractEstablishment(text, lines) {
  // Palavras-chave que indicam nome do estabelecimento
  const patterns = [
    /(?:CNPJ[\s:]*)\d{2}[\.\s]?\d{3}[\.\s]?\d{3}[\/\s]?\d{4}[\-\s]?\d{2}\s*[-–]\s*([^\n]+)/i,
    /(?:raz[ãa]o\s+social[\s:]*)([^\n]+)/i,
    /(?:nome\s+fantasia[\s:]*)([^\n]+)/i,
    /(?:estabelecimento[\s:]*)([^\n]+)/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim().substring(0, 100);
    }
  }
  
  // Tentar pegar primeira linha significativa (não CNPJ, não data)
  for (const line of lines.slice(0, 5)) {
    const cleanLine = line.replace(/\d{2}[\.\s]?\d{3}[\.\s]?\d{3}[\/\s]?\d{4}[\-\s]?\d{2}/g, '').trim();
    if (cleanLine.length > 3 && cleanLine.length < 100 && !/^\d+$/.test(cleanLine)) {
      return cleanLine;
    }
  }
  
  return 'Estabelecimento não identificado';
}

/**
 * Extrai descrição do gasto
 */
function extractDescription(text, lines) {
  // Procurar por itens/produtos
  const itemPatterns = [
    /(?:descri[çc][ãa]o|item|produto|servi[çc]o)[\s:]*([^\n]+)/gi,
    /(\d+)\s+x\s+([^\n]+?)\s+R?\$\s*[\d.,]+/gi
  ];
  
  const itens = [];
  
  for (const pattern of itemPatterns) {
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) {
      const item = (match[2] || match[1]).trim();
      if (item.length > 2 && item.length < 100) {
        itens.push(item);
      }
    }
  }
  
  if (itens.length > 0) {
    return itens.slice(0, 3).join(', ').substring(0, 200);
  }
  
  return 'Descrição não disponível';
}

/**
 * Categoriza o gasto baseado no estabelecimento e descrição
 */
function categorizeExpense(estabelecimento, descricao, text) {
  const textoCompleto = (estabelecimento + ' ' + descricao + ' ' + text).toLowerCase();
  
  const categorias = {
    'Alimentação': [
      'restaurante', 'lanchonete', 'padaria', 'mercado', 'supermercado', 'açougue',
      'peixaria', 'hortifruti', 'confeitaria', 'pizzaria', 'hamburgueria', 'sorveteria',
      'cafeteria', 'bar', 'boteco', 'ifood', 'uber eats', 'rappi', 'delivery',
      'mcdonald', 'burger king', 'subway', 'giraffas', 'bob\'s', 'habib\'s',
      'assai', 'carrefour', 'extra', 'pão de açúcar', 'sonda', 'mambo', 'dalben'
    ],
    'Transporte': [
      'posto', 'combustível', 'gasolina', 'álcool', 'diesel', 'etanol',
      'uber', '99', 'cabify', 'táxi', 'transporte', 'ônibus', 'metrô', ' trem',
      'estacionamento', 'pedágio', 'mecânica', 'oficina', 'auto center',
      'shell', 'ipiranga', 'br', 'ale', 'raizen', 'petrobras'
    ],
    'Moradia': [
      'aluguel', 'condomínio', 'iptu', 'luz', 'água', 'gás', 'energia',
      'eletricidade', 'internet', 'telefone', 'tv a cabo', 'streaming',
      'netflix', 'spotify', 'amazon prime', 'disney', 'hbo max',
      'material de construção', 'madeireira', 'depósito', 'leroy merlin',
      'casas bahia', 'magazine luiza', 'ponto frio', 'extra', 'leroy'
    ],
    'Lazer': [
      'cinema', 'teatro', 'show', 'evento', 'parque', 'museu', 'zoológico',
      'viagem', 'hotel', 'pousada', 'hostel', 'resort', 'passagem aérea',
      'academia', 'clube', 'associação', 'assinatura', 'jogo', 'passeio',
      'ingresso', 'netflix', 'spotify', 'prime video', 'disney+', 'hbo'
    ],
    'Saúde': [
      'farmácia', 'drogaria', 'hospital', 'clínica', 'consultório', 'médico',
      'dentista', 'laboratório', 'exame', 'vacina', 'remédio', 'medicamento',
      'plano de saúde', 'seguro saúde', 'unimed', 'amil', 'bradesco saúde',
      'sulamérica', 'hapvida', 'notre dame', 'intermédica', 'raia', 'drogasil'
    ]
  };
  
  for (const [categoria, palavrasChave] of Object.entries(categorias)) {
    for (const palavra of palavrasChave) {
      if (textoCompleto.includes(palavra.toLowerCase())) {
        return categoria;
      }
    }
  }
  
  return 'Outros';
}

/**
 * Extrai método de pagamento
 */
function extractPaymentMethod(text) {
  const textoLower = text.toLowerCase();
  
  if (textoLower.includes('pix')) return 'PIX';
  if (textoLower.includes('débito') || textoLower.includes('debito')) return 'Débito';
  if (textoLower.includes('crédito') || textoLower.includes('credito')) return 'Crédito';
  if (textoLower.includes('dinheiro') || textoLower.includes('espécie')) return 'Dinheiro';
  if (textoLower.includes('boleto')) return 'Boleto';
  if (textoLower.includes('transferência') || textoLower.includes('ted') || textoLower.includes('doc')) return 'Transferência';
  
  return 'Não identificado';
}

module.exports = {
  processDocument,
  extractFromPDF,
  extractFromImage,
  extractFinancialData,
  extractDate,
  extractValue,
  categorizeExpense
};
