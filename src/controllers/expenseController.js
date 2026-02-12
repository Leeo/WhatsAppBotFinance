/**
 * 🌐 CONTROLLER DA API - GASTOS
 * 
 * Rotas REST para gerenciamento de gastos
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { 
  addExpense, 
  getAllExpenses, 
  getExpenseById, 
  updateExpense, 
  deleteExpense,
  getExpenseSummary 
} = require('../database/db');
const { processDocument, extractFinancialData } = require('../ocr/documentProcessor');
const fs = require('fs-extra');

// Configuração do Multer para upload de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const subDir = ext === '.pdf' ? 'pdfs' : 'images';
    const dest = path.join(__dirname, '../../uploads', subDir);
    fs.ensureDirSync(dest);
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'doc-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não suportado'));
    }
  }
});

// ============ ROTAS ============

/**
 * GET /api/expenses
 * Lista todos os gastos com filtros opcionais
 */
router.get('/', async (req, res) => {
  try {
    const filters = {
      usuario: req.query.usuario,
      categoria: req.query.categoria,
      dataInicio: req.query.dataInicio,
      dataFim: req.query.dataFim,
      mes: req.query.mes,
      ano: req.query.ano
    };

    // Remover filtros undefined
    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined) delete filters[key];
    });

    const expenses = await getAllExpenses(filters);
    
    res.json({
      success: true,
      count: expenses.length,
      data: expenses
    });
  } catch (error) {
    console.error('❌ Erro ao listar gastos:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar gastos',
      message: error.message
    });
  }
});

/**
 * GET /api/expenses/summary
 * Retorna resumo de gastos
 */
router.get('/summary', async (req, res) => {
  try {
    const filters = {
      usuario: req.query.usuario,
      mes: req.query.mes,
      ano: req.query.ano
    };

    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined) delete filters[key];
    });

    const summary = await getExpenseSummary(filters);
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('❌ Erro ao buscar resumo:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar resumo',
      message: error.message
    });
  }
});

/**
 * GET /api/expenses/:id
 * Busca um gasto específico
 */
router.get('/:id', async (req, res) => {
  try {
    const expense = await getExpenseById(req.params.id);
    
    if (!expense) {
      return res.status(404).json({
        success: false,
        error: 'Gasto não encontrado'
      });
    }
    
    res.json({
      success: true,
      data: expense
    });
  } catch (error) {
    console.error('❌ Erro ao buscar gasto:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar gasto',
      message: error.message
    });
  }
});

/**
 * POST /api/expenses
 * Cria um novo gasto manualmente
 */
router.post('/', async (req, res) => {
  try {
    const { data, usuario, estabelecimento, valor, categoria, descricao_curta, metodo_pagamento } = req.body;

    // Validação
    if (!data || !usuario || !estabelecimento || !valor || !categoria) {
      return res.status(400).json({
        success: false,
        error: 'Dados incompletos',
        required: ['data', 'usuario', 'estabelecimento', 'valor', 'categoria']
      });
    }

    const expense = await addExpense({
      data,
      usuario,
      estabelecimento,
      valor: parseFloat(valor),
      categoria,
      descricao_curta,
      metodo_pagamento
    });

    res.status(201).json({
      success: true,
      message: 'Gasto registrado com sucesso',
      data: expense
    });
  } catch (error) {
    console.error('❌ Erro ao criar gasto:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao criar gasto',
      message: error.message
    });
  }
});

/**
 * POST /api/expenses/upload
 * Faz upload de documento e extrai dados automaticamente
 */
router.post('/upload', upload.single('documento'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo enviado'
      });
    }

    const usuario = req.body.usuario || 'API User';
    const filePath = req.file.path;

    console.log(`📄 Processando upload: ${req.file.originalname}`);

    // Processar documento
    const result = await processDocument(filePath);

    if (!result.success) {
      await fs.remove(filePath).catch(() => {});
      return res.status(422).json({
        success: false,
        error: 'Não foi possível processar o documento',
        details: result.error
      });
    }

    // Extrair dados financeiros
    const expenseData = extractFinancialData(result.text, usuario);

    // Salvar no banco
    const savedExpense = await addExpense(expenseData);

    res.status(201).json({
      success: true,
      message: 'Documento processado com sucesso',
      data: {
        expense: savedExpense,
        extracted_text: result.text.substring(0, 1000), // Primeiros 1000 caracteres
        processing_info: {
          pages: result.pages || 1,
          confidence: result.confidence || null,
          words: result.words || null
        }
      }
    });

  } catch (error) {
    console.error('❌ Erro no upload:', error);
    if (req.file) {
      await fs.remove(req.file.path).catch(() => {});
    }
    res.status(500).json({
      success: false,
      error: 'Erro ao processar upload',
      message: error.message
    });
  }
});

/**
 * PUT /api/expenses/:id
 * Atualiza um gasto
 */
router.put('/:id', async (req, res) => {
  try {
    const updates = req.body;
    const result = await updateExpense(req.params.id, updates);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'Gasto não encontrado'
      });
    }

    const updated = await getExpenseById(req.params.id);

    res.json({
      success: true,
      message: 'Gasto atualizado com sucesso',
      data: updated
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar gasto:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao atualizar gasto',
      message: error.message
    });
  }
});

/**
 * DELETE /api/expenses/:id
 * Remove um gasto
 */
router.delete('/:id', async (req, res) => {
  try {
    const result = await deleteExpense(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'Gasto não encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Gasto removido com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao remover gasto:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao remover gasto',
      message: error.message
    });
  }
});

/**
 * GET /api/expenses/stats/categories
 * Estatísticas por categoria
 */
router.get('/stats/categories', async (req, res) => {
  try {
    const filters = {
      usuario: req.query.usuario,
      mes: req.query.mes,
      ano: req.query.ano
    };

    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined) delete filters[key];
    });

    const summary = await getExpenseSummary(filters);
    
    res.json({
      success: true,
      data: summary.por_categoria
    });
  } catch (error) {
    console.error('❌ Erro ao buscar estatísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar estatísticas',
      message: error.message
    });
  }
});

module.exports = router;
