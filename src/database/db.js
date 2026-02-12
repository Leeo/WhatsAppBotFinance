/**
 * 📦 MÓDULO DE BANCO DE DADOS
 * SQLite para armazenamento de gastos
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/expenses.db');

let db = null;

/**
 * Inicializa o banco de dados
 */
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('❌ Erro ao abrir banco de dados:', err);
        reject(err);
        return;
      }
      
      console.log('✅ Conectado ao SQLite');
      
      // Criar tabela de gastos
      db.run(`
        CREATE TABLE IF NOT EXISTS expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          data TEXT NOT NULL,
          usuario TEXT NOT NULL,
          estabelecimento TEXT NOT NULL,
          valor REAL NOT NULL,
          categoria TEXT NOT NULL,
          descricao_curta TEXT,
          metodo_pagamento TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.error('❌ Erro ao criar tabela:', err);
          reject(err);
          return;
        }
        
        // Criar índices para consultas rápidas
        db.run(`CREATE INDEX IF NOT EXISTS idx_data ON expenses(data)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_usuario ON expenses(usuario)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_categoria ON expenses(categoria)`);
        
        console.log('✅ Tabela de gastos criada/verificada');
        resolve();
      });
    });
  });
}

/**
 * Adiciona um novo gasto
 */
function addExpense(expense) {
  return new Promise((resolve, reject) => {
    const { data, usuario, estabelecimento, valor, categoria, descricao_curta, metodo_pagamento } = expense;
    
    const sql = `
      INSERT INTO expenses (data, usuario, estabelecimento, valor, categoria, descricao_curta, metodo_pagamento)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.run(sql, [data, usuario, estabelecimento, valor, categoria, descricao_curta || '', metodo_pagamento || ''], function(err) {
      if (err) {
        console.error('❌ Erro ao inserir gasto:', err);
        reject(err);
        return;
      }
      
      resolve({
        id: this.lastID,
        ...expense
      });
    });
  });
}

/**
 * Busca todos os gastos
 */
function getAllExpenses(filters = {}) {
  return new Promise((resolve, reject) => {
    let sql = 'SELECT * FROM expenses WHERE 1=1';
    const params = [];
    
    if (filters.usuario) {
      sql += ' AND usuario = ?';
      params.push(filters.usuario);
    }
    
    if (filters.categoria) {
      sql += ' AND categoria = ?';
      params.push(filters.categoria);
    }
    
    if (filters.dataInicio) {
      sql += ' AND data >= ?';
      params.push(filters.dataInicio);
    }
    
    if (filters.dataFim) {
      sql += ' AND data <= ?';
      params.push(filters.dataFim);
    }
    
    if (filters.mes) {
      sql += ' AND strftime("%m", data) = ?';
      params.push(filters.mes.padStart(2, '0'));
    }
    
    if (filters.ano) {
      sql += ' AND strftime("%Y", data) = ?';
      params.push(filters.ano);
    }
    
    sql += ' ORDER BY data DESC, created_at DESC';
    
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('❌ Erro ao buscar gastos:', err);
        reject(err);
        return;
      }
      
      resolve(rows);
    });
  });
}

/**
 * Busca gasto por ID
 */
function getExpenseById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM expenses WHERE id = ?', [id], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

/**
 * Atualiza um gasto
 */
function updateExpense(id, updates) {
  return new Promise((resolve, reject) => {
    const fields = [];
    const values = [];
    
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    });
    
    if (fields.length === 0) {
      reject(new Error('Nenhum campo para atualizar'));
      return;
    }
    
    values.push(id);
    
    const sql = `UPDATE expenses SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    
    db.run(sql, values, function(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve({ changes: this.changes });
    });
  });
}

/**
 * Remove um gasto
 */
function deleteExpense(id) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM expenses WHERE id = ?', [id], function(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve({ changes: this.changes });
    });
  });
}

/**
 * Obtém resumo de gastos
 */
function getExpenseSummary(filters = {}) {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT 
        COUNT(*) as total_transacoes,
        SUM(valor) as total_gasto,
        AVG(valor) as media_gasto,
        MAX(valor) as maior_gasto,
        MIN(valor) as menor_gasto
      FROM expenses 
      WHERE 1=1
    `;
    const params = [];
    
    if (filters.usuario) {
      sql += ' AND usuario = ?';
      params.push(filters.usuario);
    }
    
    if (filters.mes) {
      sql += ' AND strftime("%m", data) = ?';
      params.push(filters.mes.padStart(2, '0'));
    }
    
    if (filters.ano) {
      sql += ' AND strftime("%Y", data) = ?';
      params.push(filters.ano);
    }
    
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      
      // Gastos por categoria
      let categoriaSql = `
        SELECT 
          categoria,
          COUNT(*) as quantidade,
          SUM(valor) as total
        FROM expenses 
        WHERE 1=1
      `;
      
      if (filters.usuario) {
        categoriaSql += ' AND usuario = ?';
      }
      if (filters.mes) {
        categoriaSql += ' AND strftime("%m", data) = ?';
      }
      if (filters.ano) {
        categoriaSql += ' AND strftime("%Y", data) = ?';
      }
      
      categoriaSql += ' GROUP BY categoria ORDER BY total DESC';
      
      db.all(categoriaSql, params, (err, categorias) => {
        if (err) {
          reject(err);
          return;
        }
        
        resolve({
          ...row,
          por_categoria: categorias
        });
      });
    });
  });
}

/**
 * Fecha conexão com banco de dados
 */
function closeDatabase() {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        console.log('🔒 Conexão com banco de dados fechada');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

module.exports = {
  initializeDatabase,
  addExpense,
  getAllExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
  getExpenseSummary,
  closeDatabase
};
