const express = require('express');
const path = require('path');

const app = express();

// Railway injeta a porta correta na variável de ambiente PORT
const PORT = process.env.PORT || 3000;

// Serve todos os arquivos estáticos da pasta atual (html, css, js, imagens)
app.use(express.static(path.join(__dirname)));

// Fallback: qualquer rota cai no index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
