export const LANG_KEY = 'gm:lang';
export type Lang = 'en' | 'pt';
export const DEFAULT_LANG: Lang = 'en';

export const TRANSLATIONS = {
  en: {
    nav_progress: 'Progress',
    nav_plan: 'Plan',
    toggle_theme: 'Toggle theme',
    status_toca_bem: 'Plays well',
    status_parcial: 'Partial',
    status_wishlist: 'Wishlist',
    status_sem_status: 'No status',
    columns: 'Columns',
    column_aria: 'Number of columns',
    filter_search: 'Search',
    filter_search_placeholder: 'Title or artist…',
    filter_level: 'Level',
    filter_status: 'Status',
    filter_artist: 'Artist',
    filter_all: 'All',
    filter_clear: 'Clear',
    status_filter_plays_well: '🟢 Plays well',
    status_filter_partial: '🟡 Partial',
    status_filter_wishlist: '🔴 Wishlist',
    status_filter_no_status: '⚪ No status',
    repertoire: 'Repertoire',
    back_repertoire: '← Repertoire',
    original_key: 'Original key:',
    playing_in: 'Playing in:',
    key_label: 'Key',
    transpose_down: 'Transpose down',
    transpose_up: 'Transpose up',
    reset: 'Reset',
    no_cifra: 'Chord sheet not yet added.',
    progress_title: 'Progress',
    by_level: 'By level',
    by_status: 'By status',
    overview: 'Overview',
    plan_title: 'Study Plan',
    plan_subtitle: 'Track your progress — saved automatically',
    phase: 'Phase',
    chords_used: 'Chords used',
    no_diagram: 'no diagram',
    free_form: 'free form',
  },
  pt: {
    nav_progress: 'Progresso',
    nav_plan: 'Plano',
    toggle_theme: 'Alternar tema',
    status_toca_bem: 'Toco bem',
    status_parcial: 'Parcial',
    status_wishlist: 'Wishlist',
    status_sem_status: 'Sem status',
    columns: 'Colunas',
    column_aria: 'Número de colunas',
    filter_search: 'Busca',
    filter_search_placeholder: 'Título ou artista…',
    filter_level: 'Nível',
    filter_status: 'Status',
    filter_artist: 'Artista',
    filter_all: 'Todos',
    filter_clear: 'Limpar',
    status_filter_plays_well: '🟢 Toco bem',
    status_filter_partial: '🟡 Parcial',
    status_filter_wishlist: '🔴 Wishlist',
    status_filter_no_status: '⚪ Sem status',
    repertoire: 'Repertório',
    back_repertoire: '← Repertório',
    original_key: 'Tom original:',
    playing_in: 'Tocando em:',
    key_label: 'Tom',
    transpose_down: 'Transpor para baixo',
    transpose_up: 'Transpor para cima',
    reset: 'Reset',
    no_cifra: 'Cifra ainda não adicionada.',
    progress_title: 'Progresso',
    by_level: 'Por nível',
    by_status: 'Por status',
    overview: 'Visão geral',
    plan_title: 'Plano de Estudos',
    plan_subtitle: 'Marque seu progresso — salvo automaticamente',
    phase: 'Fase',
    chords_used: 'Acordes utilizados',
    no_diagram: 'sem diagrama',
    free_form: 'forma livre',
  },
} as const;

export type TranslationKey = keyof typeof TRANSLATIONS.en;

export function getLang(): Lang {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored === 'en' || stored === 'pt') return stored;
  } catch {}
  return DEFAULT_LANG;
}

export function t(key: TranslationKey, lang?: Lang): string {
  const l = lang ?? getLang();
  return (TRANSLATIONS[l] as Record<string, string>)[key] ?? key;
}

export function tCount(n: number, singularKey: TranslationKey, pluralKey: TranslationKey, lang?: Lang): string {
  const template = t(n === 1 ? singularKey : pluralKey, lang);
  return template.replace('$n', String(n));
}
