# Monitor de Índice de Calor — Macaé

Aplicação web em React + TypeScript + Vite para explorar o índice de calor (IC)
das estações meteorológicas dos bairros de Macaé (RJ) em uma matriz de calor de
dias × horas.

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
