#!/usr/bin/env node
// Roda os testes do app e do painel (tests/e2e) em paralelo, cada um numa porta própria.
//   node tests/rodar.cjs                  → todos
//   node tests/rodar.cjs test36 test63    → só esses (aceita parte do nome)
//   node tests/rodar.cjs --paralelo 2     → quantos ao mesmo tempo (padrão: metade dos núcleos, de 2 a 6)
// No fim, mostra o resumo e sai com erro se algum falhou. As capturas de tela ficam em tests/saida (fora do Git).
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PASTA = path.join(__dirname, 'e2e');
const SAIDA = path.join(__dirname, 'saida');
const args = process.argv.slice(2);
const iPar = args.indexOf('--paralelo');
const paralelo = iPar >= 0 ? Math.max(1, Number(args[iPar + 1]) || 1) : Math.min(6, Math.max(2, Math.floor(os.cpus().length / 2)));
const filtros = args.filter((a, i) => !a.startsWith('--') && (iPar < 0 || i !== iPar + 1));
const todos = fs.readdirSync(PASTA).filter((f) => /^test\d+\.cjs$/.test(f)).sort();
const fila = filtros.length ? todos.filter((f) => filtros.some((x) => f.includes(x))) : todos;
if (!fila.length) { console.error('Nenhum teste encontrado com esse nome.'); process.exit(2); }
fs.mkdirSync(SAIDA, { recursive: true });

const LIMITE_MS = 10 * 60 * 1000;
const inicio = Date.now();
const resultados = [];
const seg = (ms) => `${Math.round(ms / 1000)} s`;

function rodar(arquivo, porta) {
  return new Promise((ok) => {
    const t0 = Date.now();
    const filho = spawn(process.execPath, [path.join(PASTA, arquivo)], { cwd: SAIDA, env: { ...process.env, PORTA_TESTE: String(porta) } });
    let saida = '';
    filho.stdout.on('data', (d) => { saida += d; });
    filho.stderr.on('data', (d) => { saida += d; });
    const relogio = setTimeout(() => { saida += '\nPassou do tempo limite de 10 min.'; filho.kill('SIGKILL'); }, LIMITE_MS);
    filho.on('close', (codigo) => {
      clearTimeout(relogio);
      const falhas = saida.split('\n').filter((l) => l.startsWith('FAIL'));
      const passou = codigo === 0 && !falhas.length;
      const r = { arquivo, passou, ms: Date.now() - t0, falhas, saida };
      resultados.push(r);
      console.log(`${passou ? '✅' : '❌'} ${arquivo.replace('.cjs', '')}  ${seg(r.ms)}  (${resultados.length}/${fila.length})`);
      ok();
    });
  });
}

(async () => {
  console.log(`Rodando ${fila.length} testes, ${paralelo} ao mesmo tempo…`);
  const pendentes = [...fila];
  const trabalhadores = Array.from({ length: Math.min(paralelo, fila.length) }, async (_, i) => {
    while (pendentes.length) await rodar(pendentes.shift(), 8800 + i);
  });
  await Promise.all(trabalhadores);
  const ruins = resultados.filter((r) => !r.passou);
  for (const r of ruins) {
    console.log(`\n──── ${r.arquivo} ────`);
    const detalhe = r.falhas.length ? r.falhas : r.saida.trim().split('\n').slice(-12);
    console.log(detalhe.join('\n'));
  }
  console.log(`\n${resultados.length - ruins.length} de ${resultados.length} passaram em ${seg(Date.now() - inicio)}.`);
  process.exit(ruins.length ? 1 : 0);
})();
