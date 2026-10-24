# Monitor de Índice de Calor — Macaé

Aplicação web em React + TypeScript + Vite para explorar o índice de calor (IC)
das estações meteorológicas dos bairros de Macaé (RJ) em uma matriz de calor de
dias × horas.

## Requisitos

- Node.js 20+
- npm

## Scripts

| Script            | Descrição                                  |
| ----------------- | ------------------------------------------ |
| `npm run dev`     | Inicia o servidor de desenvolvimento       |
| `npm run build`   | Verifica os tipos e gera o build de produção |
| `npm run preview` | Serve o build de produção localmente       |
| `npm test`        | Executa os testes uma vez                  |
| `npm run test:watch` | Executa os testes em modo observação    |
| `npm run lint`    | Executa o ESLint                           |
| `npm run typecheck` | Verifica os tipos com `tsc -b`           |

## Estrutura

```
data/       CSVs de observações (versionados)
docs/       Especificação local (ignorada pelo git)
roadmap/    Etapas de desenvolvimento (ignorado pelo git)
src/
  app/      Componentes e composição da aplicação
  styles/   Design tokens e estilos globais
  tests/    Testes automatizados
```
