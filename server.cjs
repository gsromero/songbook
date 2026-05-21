const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;

// Serve arquivos estáticos do build Astro
app.use(express.static(path.join(__dirname, 'dist'), {
  extensions: ['html'],
}));

// Fallback 404
app.use((req, res) => {
  const notFound = path.join(__dirname, 'dist', '404.html');
  res.status(404).sendFile(notFound, (err) => {
    if (err) res.status(404).send('Página não encontrada');
  });
});

app.listen(PORT, () => {
  console.log(`Songbook rodando na porta ${PORT}`);
});
