const bcrypt = require('bcryptjs');
const { getDb } = require('./database.cjs');
const { generateChordSVGs, extractChordsFromCifra } = require('../services/chords.cjs');

const LONDON_LONDON_CIFRA = `[Intro]
A   E   A


[Primeira Parte]
A                E                       A
I'm wandering round and round, nowhere to go
D                E                  A
I'm lonely in London, London, is lovely so
D                  E                  A    F#m
I cross the streets without fear, everybody keeps the way clear
D                       E    A
I know there's no one here to say hello
D                       E             A    F#m
I know they keep the way clear, I am lonely in London without fear
D                E                A
I'm wandering round and round, nowhere to go


[Refrão]
D       E D E    A
While my eyes, go looking for flying saucers in the sky
D       E D E    A
But my eyes, go looking for flying saucers in the sky


[Segunda Parte]
A                  E           A
Oh, Sunday, Monday, Autumn pass by me
D                E          A
And people hurry on so peacefully
D                E              A    F#m
A group approach the policeman, he seems so pleased to please them
D                       E    A
It's good to live at least and I agree
D                          E             A    F#m
He seemed so pleased at least and it's so good to live in peace
D                E          A
And Sunday, Monday years and I agree


[Final]
D                       E    A
I know there's no one here to say hello
D                     E         A
I choose no face to look at, choose no way
D                     E          A    F#m
I just happen to be here and it's ok
D                  E         A
Green grass, blue eyes, gray sky
D       E D E    A
While my eyes, go looking for flying saucers in the sky
D       E D E    A
But my eyes, go looking for flying saucers in the sky`;

async function seed() {
  const db = getDb();

  // Criar usuário admin se não existir
  const userCount = db.prepare('SELECT COUNT(*) as n FROM users').get();
  if (userCount.n === 0) {
    const hash = bcrypt.hashSync('E5b2q9a7!20', 10);
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('gsromero', hash);
    console.log('[seed] Usuário admin criado: gsromero');
  }

  // Migrar london-london se banco vazio
  const musicaCount = db.prepare('SELECT COUNT(*) as n FROM musicas').get();
  if (musicaCount.n === 0) {
    const chords = extractChordsFromCifra(LONDON_LONDON_CIFRA);
    const chordSvgs = generateChordSVGs(chords);

    db.prepare(`
      INSERT INTO musicas (slug, titulo, artista, tom, tom_original, tags, cifra, chord_svgs, link_cifraclub, link_youtube)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'london-london',
      'London London',
      'Caetano Veloso',
      'A',
      'D',
      JSON.stringify(['mpb', 'dedilhado-simples']),
      LONDON_LONDON_CIFRA,
      JSON.stringify(chordSvgs),
      '',
      ''
    );
    console.log('[seed] London London migrada para o banco');
  }
}

module.exports = { seed };
