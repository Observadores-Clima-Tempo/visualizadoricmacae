# Monitor de Índice de Calor — Macaé

Aplicação web em React + TypeScript + Vite para explorar o índice de calor (IC)
das estações meteorológicas dos bairros de Macaé (RJ) em uma matriz de calor de
dias × horas.

A versão 1 cobre o período **01/12/2024 a 28/02/2025** (90 dias), um bairro por
vez, com as faixas de risco canônicas (Sem alerta, Cuidado, Cuidado Extremo,
Perigo e Perigo Extremo), tooltip e navegação por teclado.

## Requisitos

- Node.js 20+
- npm

## Como rodar

```bash
npm install
npm run dev       # http://localhost:5173
```

Build de produção e conferência local:

```bash
npm run build
npm run preview   # http://localhost:4173
```

## Scripts

| Script                  | Descrição                                          |
| ----------------------- | -------------------------------------------------- |
| `npm run dev`           | Inicia o servidor de desenvolvimento               |
| `npm run build`         | Verifica os tipos e gera o build de produção       |
| `npm run preview`       | Serve o build de produção localmente               |
| `npm test`              | Executa os testes uma vez                          |
| `npm run test:watch`    | Executa os testes em modo observação               |
| `npm run test:coverage` | Executa os testes com cobertura (meta: 90% de linhas e 85% de branches em `src/domain` e `src/data`) |
| `npm run lint`          | Executa o ESLint                                   |
| `npm run typecheck`     | Verifica os tipos com `tsc -b`                     |

## Estrutura

```
data/            CSVs de observações (versionados)
src/
  app/           Composição da página (App)
  components/    controls/ (seletor), heatmap/ (matriz, célula, tooltip) e ui/ (estados)
  data/          Importação: leitura dos CSVs, normalização de data/hora e números
  domain/        Regras puras: faixas de risco e grade dias × horas
  hooks/         useHeatIndexData — único elo entre importação e domínio
  styles/        Design tokens e estilos globais
  tests/         Testes automatizados (Vitest + Testing Library)
docs/            Especificação local (NÃO versionada)
roadmap/         Etapas de desenvolvimento (NÃO versionadas)
```

`docs/` e `roadmap/` existem apenas na máquina de quem desenvolve: estão no
`.gitignore` e não fazem parte do repositório.

## Dados

### Como adicionar um bairro

1. Coloque o arquivo em `data/` com o nome do bairro: `data/São João.csv` →
   rótulo **São João**, identificador `sao-joao`.
2. **Reinicie o `npm run dev`** (ou refaça o build). Os CSVs são lidos em tempo
   de build por `import.meta.glob`, portanto o arquivo passa a fazer parte do
   bundle — não há upload nem leitura em tempo de execução nesta versão.
3. O bairro aparece automaticamente no seletor, em ordem alfabética (pt-BR).
4. Para remover um bairro, apague o CSV e reinicie o servidor.

### Formato aceito

O cabeçalho é resolvido **pelo nome da coluna**, nunca pela posição, e é
normalizado (BOM, espaços, caixa). Colunas obrigatórias e opcionais:

| Coluna    | Obrigatória | Uso                                   |
| --------- | ----------- | ------------------------------------- |
| `Date`    | sim         | data da leitura                       |
| `IC (C°)` | sim         | índice de calor em °C                 |
| `Time`    | não         | hora da leitura quando fora do `Date` |
| `Temp (C)`| não         | guardada na leitura normalizada       |
| `UR (%)`  | não         | guardada na leitura normalizada       |

Formatos de data/hora reconhecidos: `YYYY-MM-DD` (+ coluna `Time`),
`YYYY-MM-DD HH:MM`, `YYYY-MM-DDTHH:MM`, `DD-MMM-YYYY HH:MM` (mês abreviado em
pt-BR, como em `01-dez-2024 00:00`) e `DD/MM/YYYY HH:MM`.

### Regras de normalização

- **Hora cheia:** leituras com minuto ≥ 40 caem na hora seguinte; `23:59` vira
  `00h` do dia seguinte.
- **Mesma hora:** leituras no mesmo `(dia, hora)` viram uma média, com
  `readingCount` guardando quantas foram agrupadas.
- **Linhas inválidas são descartadas** e contabilizadas por motivo: data
  inválida, IC ausente, IC não numérico, IC ≤ 0 (sentinela dos arquivos) e
  temperatura/umidade ausentes.
- **Nada é interpolado:** célula sem leitura válida fica vazia (`—`), nunca `0`
  e nunca com a cor de uma faixa de risco.

## Qualidade

### Testes e cobertura

```bash
npm run test:coverage
```

- 108 testes em 7 arquivos (domínio, importação, componentes e smoke).
- Cobertura de `src/domain` + `src/data`: **100% de linhas** e **88,6% de
  branches** (metas: 90% e 85%). O relatório HTML fica em `coverage/`.
- Os testes de dados usam os CSVs reais de `data/`: contagens de aceitos,
  agrupamento de horários duplicados e valores conhecidos (ex.: Trapiche em
  19/01/2025 às 14h = 53,4 °C) são verificados contra o arquivo.

### Checklist manual de QA — V1

Executado em `npm run preview` (build de produção), nos seis bairros:

- [x] A matriz abre com 90 linhas (2.160 células) em todos os bairros.
- [x] Cabeçalho de horas e coluna de datas permanecem fixos ao rolar nos dois
      eixos.
- [x] Nenhuma célula sem dado aparece colorida (todas usam a superfície neutra
      `--color-surface-muted`).
- [x] O tooltip abre, fecha no `pointerout`/`Escape` e permanece dentro da
      viewport no extremo inferior direito.
- [x] Navegar 10 células com as setas mantém o foco visível e um único ponto de
      tabulação na matriz.
- [x] O rodapé mostra as contagens do bairro ativo (`90 dias no período`).

Verificações por bairro:

- [x] **Barreto** exibe 46,0 °C na hora 15 de 02/12/2024 (duas leituras
      agrupadas, `readingCount = 2`).
- [x] **Cabiunas** tem 90 dias completos; 05/01/2025 mostra a hora 0 (22,2 °C) e
      fica sem dado na hora 1 e das 6h às 23h — as leituras desses horários têm
      IC negativo no CSV e são descartadas.
- [x] **Mirante** mantém os dias de janeiro sem dado na lista (ex.: 18/01/2025,
      com as 24 células vazias).
- [x] **Trapiche** exibe o maior valor da base (53,4 °C em 19/01/2025 às 14h) e
      nenhuma célula em Perigo Extremo.
- [x] **Visconde** mostra as horas vazias de 28/01 e 17/02.
- [x] **Miramar** tem 3 horas duplicadas (Barreto 11 e Visconde 8), todas
      agrupadas corretamente.

Divergência registrada em relação à especificação: o checklist previa
"Cabiunas 05/01/2025 apenas com a hora 0", mas o arquivo tem IC válido também
nas horas 2 a 5. O comportamento correto é o dos dados, e o teste
`heatIndexGrid.test.ts` documenta o caso.

### Desempenho (build de produção)

| Medida                                | Resultado               |
| ------------------------------------- | ----------------------- |
| `dist/assets/index-*.js`              | 1.051 kB (326 kB gzip)  |
| `dist/assets/index-*.css`             | 13,2 kB (3,4 kB gzip)   |
| CSVs em `data/` (embutidos no bundle) | 780 kB                  |
| Troca de bairro                       | 68 a 91 ms              |
| 20 eventos de hover na matriz         | 17 ms (sem re-render de linha) |

O cartão acompanha a largura da tela até 1.720 px: a matriz estica as 24
colunas de horas para preencher o espaço (células de 38 px a 63 px, linhas de
26 px a 30 px). Na vertical, a página nunca rola: o painel ocupa exatamente a
altura da viewport e a matriz usa o que sobra entre cabeçalho e rodapé,
rolando internamente. Abaixo de ~1.100 px de largura a tabela volta à largura
natural e a rolagem horizontal assume.

Os CSVs entram no bundle nesta versão — decisão aceita para a V1. O limite de
aviso de chunk do Vite foi ajustado para 1.200 kB justamente por isso; quando o
dataset crescer, o caminho é carregar os CSVs sob demanda ou separar o bundle em
chunks.

## Versão

`1.0.0` — fechamento da V1 (Etapa 09). Barra de título, filtros de período,
resumos, média horária e legenda pertencem à V2.

