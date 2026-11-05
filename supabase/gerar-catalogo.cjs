// Gera a carga inicial do catálogo (exercícios e objetivos) no supabase/schema.sql a partir da cópia que fica no app.
// O app (index.html) continua com essa cópia: é a reserva quando o banco não responde ou o SQL ainda não foi rodado.
//   node supabase/gerar-catalogo.cjs            → reescreve o trecho entre "catalogo:inicio" e "catalogo:fim"
//   node supabase/gerar-catalogo.cjs --conferir → só confere (sai com erro se o schema.sql estiver desatualizado)
const fs = require('fs'), path = require('path');
const RAIZ = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const SCHEMA = path.join(RAIZ, 'supabase', 'schema.sql');

// O trecho do app que define o catálogo roda sozinho (não depende do resto do app).
const ini = html.indexOf('  const PLANO_PADRAO = {');
const fim = html.indexOf('  const jornadaPorIdApp');
if (ini < 0 || fim < 0) throw new Error('Não achei o catálogo no index.html');
const { BIBLIOTECA_APP, JORNADAS_APP } = new Function(`${html.slice(ini, fim)}; return { BIBLIOTECA_APP, JORNADAS_APP };`)();

const sqlTexto = (s) => `'${String(s).replace(/'/g, "''")}'`;
const json = (v) => sqlTexto(JSON.stringify(v));
// Objetivos de cada exercício: os objetivos prontos em que ele aparece.
const objetivosDe = (nome) => JORNADAS_APP.filter((j) => Object.values(j.treinos).some((t) => t.exercicios.some((e) => e.nome === nome))).map((j) => j.id).sort();
const exercicios = BIBLIOTECA_APP.map((ex) => ({
  nome: ex.nome, grupo: ex.grupo, dose: ex.dose, pse: ex.pse,
  hipertrofia: ex.H, mobilidade: ex.M, forca: ex.F, explosao: ex.E, explicacao: ex.why, variacoes: ex.variacoes, objetivos: objetivosDe(ex.nome),
}));
// Nos objetivos vão só nome, dose e PSE de cada exercício (o resto vem do catálogo, como nos treinos das contas).
const jornadas = JORNADAS_APP.map((j, i) => {
  const { id, treinos, ...resto } = j;
  const t = Object.fromEntries(Object.entries(treinos).map(([n, x]) => [n, {
    nome: x.nome, subtitulo: x.subtitulo, objetivo: x.objetivo, esperado: x.esperado, impacto_jiu: x.impacto_jiu, impacto_fisico: x.impacto_fisico,
    exercicios: x.exercicios.map(({ nome, dose, pse }) => ({ nome, dose, pse })),
  }]));
  return { id, ordem: i + 1, dados: { ...resto, treinos: t } };
});

module.exports = { exercicios, jornadas };
if (require.main === module) gerar();
function gerar() {
const linhas = [
  '-- catalogo:inicio (gerado por supabase/gerar-catalogo.cjs a partir do index.html; não edite à mão)',
  '-- Carga inicial: só entra o que ainda não existe. Exercícios renomeados (nome antigo em nomes_antigos) e excluídos não voltam,',
  '-- e o que já foi editado pelo painel continua como está.',
  'insert into public.exercicios (nome, grupo, dose, pse, hipertrofia, mobilidade, forca, explosao, explicacao, variacoes, objetivos)',
  'select x.nome, x.grupo, x.dose, x.pse, x.hipertrofia, x.mobilidade, x.forca, x.explosao, x.explicacao,',
  "  array(select jsonb_array_elements_text(x.variacoes)), array(select jsonb_array_elements_text(x.objetivos))",
  'from jsonb_to_recordset($catalogo$[',
  exercicios.map((e) => '  ' + JSON.stringify(e)).join(',\n'),
  ']$catalogo$::jsonb) as x(nome text, grupo text, dose text, pse smallint, hipertrofia text, mobilidade text, forca text, explosao text, explicacao text, variacoes jsonb, objetivos jsonb)',
  'where not exists (select 1 from public.exercicios e where e.nome = x.nome or x.nome = any(e.nomes_antigos))',
  '  and not exists (select 1 from public.exercicios_excluidos d where d.nome = x.nome)',
  'on conflict do nothing;',
  '',
  'insert into public.jornadas (id, ordem, dados)',
  'select x.id, x.ordem, x.dados from jsonb_to_recordset($catalogo$[',
  jornadas.map((j) => '  ' + JSON.stringify(j)).join(',\n'),
  ']$catalogo$::jsonb) as x(id text, ordem int, dados jsonb)',
  'on conflict (id) do nothing;',
  '-- catalogo:fim',
].join('\n');

const atual = fs.readFileSync(SCHEMA, 'utf8');
const re = /-- catalogo:inicio[\s\S]*?-- catalogo:fim/;
if (!re.test(atual)) throw new Error('Não achei os marcadores catalogo:inicio / catalogo:fim no schema.sql');
const novo = atual.replace(re, () => linhas);
if (process.argv.includes('--conferir')) {
  if (novo !== atual) { console.error('FAIL o catálogo do schema.sql está diferente do index.html: rode node supabase/gerar-catalogo.cjs'); process.exit(1); }
  console.log(`PASS catálogo do schema.sql igual ao do app (${exercicios.length} exercícios, ${jornadas.length} objetivos)`);
} else {
  fs.writeFileSync(SCHEMA, novo);
  console.log(`schema.sql atualizado: ${exercicios.length} exercícios, ${jornadas.length} objetivos`);
}
}
