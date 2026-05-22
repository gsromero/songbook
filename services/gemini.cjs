const { GoogleGenerativeAI } = require('@google/generative-ai');

const TAGS_DISPONIVEIS = [
  'mpb', 'rock', 'samba', 'pagode', 'jazz', 'bossa', 'forro',
  'sertanejo', 'pop', 'latin', 'indie', 'instrumental',
  'fingerstyle', 'dedilhado-simples', 'balada', 'gospel', 'reggae',
];

async function suggestTags(titulo, artista, cifraExcerpt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[gemini] GEMINI_API_KEY não configurada');
    return [];
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `Você é um assistente especialista em música brasileira e internacional.

Analise esta música e sugira tags do estilo/gênero:

Título: ${titulo}
Artista: ${artista}
Trecho da cifra:
${cifraExcerpt.slice(0, 500)}

Tags disponíveis: ${TAGS_DISPONIVEIS.join(', ')}

Responda APENAS com um array JSON com 1 a 4 tags mais relevantes, sem explicação.
Exemplo: ["mpb", "dedilhado-simples"]`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Extrair array JSON da resposta
    const match = text.match(/\[.*?\]/s);
    if (!match) return [];

    const tags = JSON.parse(match[0]);
    // Filtrar apenas tags válidas
    return tags.filter(t => TAGS_DISPONIVEIS.includes(t));
  } catch (err) {
    console.error('[gemini] Erro ao sugerir tags:', err.message);
    return [];
  }
}

module.exports = { suggestTags };
