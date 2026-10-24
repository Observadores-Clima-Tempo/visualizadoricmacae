/**
 * Interação do mapa de calor: tooltip, destaque de linha/coluna e navegação por
 * teclado.
 *
 * Toda a delegação de eventos acontece no contêiner de rolagem e na tabela. As
 * células não recebem handler individual: com 2160 células, um listener por
 * célula custaria memória e impediria o `memo` de `HeatmapRow` de valer alguma
 * coisa.
 *
 * O destaque de cabeçalhos é escrito direto no DOM (`dataset`) em vez de virar
 * estado React — assim mover o ponteiro não re-renderiza nenhuma linha. Como o
 * CSS não compara atributos entre elementos, o atributo `data-hover-*` também é
 * espelhado no cabeçalho afetado, mantendo a resolução por CSS.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { getCell } from '@/domain/heatIndexGrid'
import type { HeatCell, HeatGrid } from '@/domain/heatIndexGrid'

export type HeatmapTooltipSource = 'pointer' | 'focus'

export type HeatmapTooltipState = {
  cell: HeatCell
  source: HeatmapTooltipSource
}

export type HeatmapActiveCell = {
  /** Dia civil no formato `YYYY-MM-DD`. */
  date: string
  hour: number
}

export type HeatmapInteraction = {
  /** Contêiner com rolagem nos dois eixos; recebe a delegação de ponteiro. */
  scrollerRef: RefObject<HTMLDivElement | null>
  tableRef: RefObject<HTMLTableElement | null>
  /** Elemento do tooltip, posicionado imperativamente pelo hook. */
  tooltipRef: RefObject<HTMLDivElement | null>
  /** Tooltip aberto, ou `null` quando não há nada a exibir. */
  tooltip: HeatmapTooltipState | null
  /** Célula dona do `tabIndex=0` (roving tabindex). */
  activeCell: HeatmapActiveCell
}

/** Célula da matriz: `data-date` e `data-hour` são a identidade da célula. */
const CELL_SELECTOR = 'td[data-date][data-hour]'

/** Distância entre o ponteiro (ou a borda da célula) e o tooltip. */
const ANCHOR_OFFSET = 12

/** Margem mínima entre o tooltip e a borda da viewport. */
const VIEWPORT_MARGIN = 8

const DAYS_PER_PAGE = 7

type Anchor = {
  /** Canto superior esquerdo desejado, em coordenadas de viewport. */
  x: number
  y: number
  /** Topo alternativo: o tooltip sobe quando não há espaço abaixo. */
  aboveY: number
}

function isElement(value: unknown): value is Element {
  return value instanceof Element
}

/** Célula `<td>` ancestral do alvo do evento, se houver. */
function findCellElement(event: Event): HTMLElement | null {
  const target = event.target
  if (!isElement(target)) return null
  const cell = target.closest(CELL_SELECTOR)
  return cell instanceof HTMLElement ? cell : null
}

function findCellByDateHour(
  table: HTMLTableElement,
  date: string,
  hour: number,
): HTMLElement | null {
  return table.querySelector<HTMLElement>(
    `${CELL_SELECTOR}[data-date="${date}"][data-hour="${hour}"]`,
  )
}

function resolveCell(grid: HeatGrid, element: HTMLElement): HeatCell | null {
  const date = element.dataset.date
  const hour = Number(element.dataset.hour)
  if (!date || !Number.isFinite(hour)) return null
  return getCell(grid, date, hour) ?? null
}

function readCellPosition(element: HTMLElement): HeatmapActiveCell | null {
  const date = element.dataset.date
  const hour = Number(element.dataset.hour)
  if (!date || !Number.isFinite(hour)) return null
  return { date, hour }
}

function pointerAnchor(event: PointerEvent): Anchor {
  return {
    x: event.clientX + ANCHOR_OFFSET,
    y: event.clientY + ANCHOR_OFFSET,
    aboveY: event.clientY - ANCHOR_OFFSET,
  }
}

function cellAnchor(element: HTMLElement): Anchor {
  const rect = element.getBoundingClientRect()
  return {
    x: rect.left + ANCHOR_OFFSET,
    y: rect.bottom + VIEWPORT_MARGIN,
    aboveY: rect.top - VIEWPORT_MARGIN,
  }
}

/**
 * Rola apenas o contêiner da matriz, o suficiente para manter a célula focada
 * visível e fora dos cabeçalhos fixos. Nunca rola a página.
 */
function ensureCellVisible(
  scroller: HTMLElement,
  table: HTMLTableElement,
  cellElement: HTMLElement,
): void {
  const scrollerRect = scroller.getBoundingClientRect()
  const cellRect = cellElement.getBoundingClientRect()
  const hourHeader = table.querySelector<HTMLElement>('thead th')
  const rowHeader = table.querySelector<HTMLElement>('tbody th')
  const stickyTop = hourHeader?.getBoundingClientRect().height ?? 0
  const stickyLeft = rowHeader?.getBoundingClientRect().width ?? 0

  const leftLimit = scrollerRect.left + stickyLeft
  const topLimit = scrollerRect.top + stickyTop

  if (cellRect.left < leftLimit) {
    scroller.scrollLeft -= leftLimit - cellRect.left
  } else if (cellRect.right > scrollerRect.right) {
    scroller.scrollLeft += cellRect.right - scrollerRect.right
  }

  if (cellRect.top < topLimit) {
    scroller.scrollTop -= topLimit - cellRect.top
  } else if (cellRect.bottom > scrollerRect.bottom) {
    scroller.scrollTop += cellRect.bottom - scrollerRect.bottom
  }
}

/**
 * Liga tooltip, destaque de cabeçalhos e navegação por teclado à grade.
 *
 * O estado React se limita à célula ativa do roving tabindex e ao tooltip
 * aberto; posição, destaque e `tabIndex` são aplicados direto no DOM.
 */
export function useHeatmapInteraction(grid: HeatGrid): HeatmapInteraction {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const tableRef = useRef<HTMLTableElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const anchorRef = useRef<Anchor | null>(null)
  const tooltipStateRef = useRef<HeatmapTooltipState | null>(null)

  const [activeCell, setActiveCell] = useState<HeatmapActiveCell>(() => ({
    date: grid.days[0] ?? '',
    hour: grid.hours[0] ?? 0,
  }))
  const [tooltip, setTooltip] = useState<HeatmapTooltipState | null>(null)

  /*
   * Troca de bairro: reinicia a célula ativa e esconde o tooltip durante o
   * próprio render (padrão de "ajustar estado quando a prop muda"), em vez de
   * provocar um segundo render a partir de um efeito.
   */
  const [gridInUse, setGridInUse] = useState(grid)
  if (gridInUse !== grid) {
    setGridInUse(grid)
    setActiveCell({ date: grid.days[0] ?? '', hour: grid.hours[0] ?? 0 })
    setTooltip(null)
  }

  const updateTooltip = useCallback((next: HeatmapTooltipState | null) => {
    tooltipStateRef.current = next
    setTooltip(next)
  }, [])

  /** Aplica a âncora atual, clampando o tooltip dentro da viewport. */
  const positionTooltip = useCallback(() => {
    const element = tooltipRef.current
    const anchor = anchorRef.current
    if (!element || !anchor) return

    const { width, height } = element.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    const maxLeft = Math.max(VIEWPORT_MARGIN, viewportWidth - VIEWPORT_MARGIN - width)
    const left = Math.min(Math.max(anchor.x, VIEWPORT_MARGIN), maxLeft)

    const fitsBelow = anchor.y + height <= viewportHeight - VIEWPORT_MARGIN
    const preferredTop = fitsBelow ? anchor.y : anchor.aboveY - height
    const maxTop = Math.max(VIEWPORT_MARGIN, viewportHeight - VIEWPORT_MARGIN - height)
    const top = Math.min(Math.max(preferredTop, VIEWPORT_MARGIN), maxTop)

    element.style.left = `${Math.round(left)}px`
    element.style.top = `${Math.round(top)}px`
    element.dataset.ready = 'true'
  }, [])

  const clearHighlight = useCallback(() => {
    const table = tableRef.current
    if (!table) return

    delete table.dataset.hoverHour
    delete table.dataset.hoverDay

    table
      .querySelectorAll<HTMLElement>('[data-hover-hour], [data-hover-day]')
      .forEach((element) => {
        element.removeAttribute('data-hover-hour')
        element.removeAttribute('data-hover-day')
      })
  }, [])

  const highlightCell = useCallback(
    (cellElement: HTMLElement) => {
      const table = tableRef.current
      if (!table) return

      clearHighlight()

      const hour = cellElement.dataset.hour ?? ''
      const date = cellElement.dataset.date ?? ''
      table.dataset.hoverHour = hour
      table.dataset.hoverDay = date

      const hourHeader = table.querySelector<HTMLElement>(`thead th[data-hour="${hour}"]`)
      if (hourHeader) hourHeader.dataset.hoverHour = 'true'

      const rowHeader = cellElement.closest('tr')?.querySelector<HTMLElement>('th')
      if (rowHeader) rowHeader.dataset.hoverDay = 'true'
    },
    [clearHighlight],
  )

  const hideTooltip = useCallback(() => {
    anchorRef.current = null
    updateTooltip(null)
    clearHighlight()
  }, [clearHighlight, updateTooltip])

  /** Fecha a interação de ponteiro, preservando o realce da célula focada. */
  const endPointerInteraction = useCallback(() => {
    const active = document.activeElement
    if (active instanceof HTMLElement && active.matches(CELL_SELECTOR)) {
      highlightCell(active)
    } else {
      clearHighlight()
    }

    if (tooltipStateRef.current?.source === 'pointer') {
      anchorRef.current = null
      updateTooltip(null)
    }
  }, [clearHighlight, highlightCell, updateTooltip])

  /** Ao trocar de bairro, nada do estado anterior pode sobreviver. */
  useEffect(() => {
    anchorRef.current = null
    tooltipStateRef.current = null

    const table = tableRef.current
    if (!table) return

    table.querySelectorAll<HTMLElement>('[data-hover-hour], [data-hover-day]').forEach((element) => {
      element.removeAttribute('data-hover-hour')
      element.removeAttribute('data-hover-day')
    })
    delete table.dataset.hoverHour
    delete table.dataset.hoverDay
  }, [grid])

  /** Reposiciona o tooltip sempre que ele (re)aparece com conteúdo novo. */
  useEffect(() => {
    if (!tooltip || !anchorRef.current) return
    positionTooltip()
  }, [tooltip, positionTooltip])

  /** `Escape` fecha o tooltip mesmo quando ele foi aberto só pelo ponteiro. */
  useEffect(() => {
    if (tooltip?.source !== 'pointer') return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hideTooltip()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [tooltip, hideTooltip])

  useEffect(() => {
    const scroller = scrollerRef.current
    const table = tableRef.current
    if (!scroller || !table) return

    const handlePointerOver = (event: PointerEvent) => {
      const cellElement = findCellElement(event)
      if (!cellElement || !scroller.contains(cellElement)) return

      const cell = resolveCell(grid, cellElement)
      if (!cell) return

      anchorRef.current = pointerAnchor(event)
      // Posiciona já com o conteúdo anterior: evita um quadro na posição antiga.
      positionTooltip()
      updateTooltip({ cell, source: 'pointer' })
      highlightCell(cellElement)
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (tooltipStateRef.current?.source !== 'pointer') return
      if (!findCellElement(event)) return

      anchorRef.current = pointerAnchor(event)
      positionTooltip()
    }

    const handlePointerOut = (event: PointerEvent) => {
      if (!findCellElement(event)) return

      const next = event.relatedTarget
      // Ir de uma célula para outra: o `pointerover` seguinte assume o tooltip.
      if (isElement(next) && next.closest(CELL_SELECTOR)) return

      endPointerInteraction()
    }

    const handleScroll = () => {
      const current = tooltipStateRef.current
      if (!current) return

      // Tooltip aberto por foco continua aberto: a célula focada segue visível.
      if (current.source === 'focus') {
        const active = document.activeElement
        if (active instanceof HTMLElement && active.matches(CELL_SELECTOR)) {
          anchorRef.current = cellAnchor(active)
          positionTooltip()
        }
        return
      }

      endPointerInteraction()
    }

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target
      if (!(target instanceof HTMLElement) || !target.matches(CELL_SELECTOR)) return

      const cell = resolveCell(grid, target)
      const position = readCellPosition(target)
      if (!cell || !position) return

      setActiveCell(position)
      anchorRef.current = cellAnchor(target)
      positionTooltip()
      updateTooltip({ cell, source: 'focus' })
      highlightCell(target)
    }

    const handleFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget
      if (isElement(next) && next.matches(CELL_SELECTOR)) return
      if (tooltipStateRef.current?.source === 'focus') hideTooltip()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (tooltipStateRef.current) {
          event.preventDefault()
          hideTooltip()
        }
        return
      }

      const target = event.target
      if (!(target instanceof HTMLElement) || !target.matches(CELL_SELECTOR)) return

      const position = readCellPosition(target)
      if (!position) return

      const dayIndex = grid.days.indexOf(position.date)
      if (dayIndex === -1) return

      const lastHourIndex = grid.hours.length - 1
      let nextDayIndex = dayIndex
      let nextHourIndex = position.hour

      switch (event.key) {
        case 'ArrowRight':
          nextHourIndex = Math.min(position.hour + 1, lastHourIndex)
          break
        case 'ArrowLeft':
          nextHourIndex = Math.max(position.hour - 1, 0)
          break
        case 'ArrowDown':
          nextDayIndex = Math.min(dayIndex + 1, grid.days.length - 1)
          break
        case 'ArrowUp':
          nextDayIndex = Math.max(dayIndex - 1, 0)
          break
        case 'Home':
          nextHourIndex = grid.hours[0] ?? 0
          break
        case 'End':
          nextHourIndex = lastHourIndex
          break
        case 'PageDown':
          nextDayIndex = Math.min(dayIndex + DAYS_PER_PAGE, grid.days.length - 1)
          break
        case 'PageUp':
          nextDayIndex = Math.max(dayIndex - DAYS_PER_PAGE, 0)
          break
        default:
          return
      }

      event.preventDefault()

      const nextDate = grid.days[nextDayIndex]
      const nextHour = grid.hours[nextHourIndex]
      const nextElement = findCellByDateHour(table, nextDate, nextHour)
      if (!nextElement || nextElement === target) return

      setActiveCell({ date: nextDate, hour: nextHour })
      nextElement.focus({ preventScroll: true })
      ensureCellVisible(scroller, table, nextElement)
    }

    scroller.addEventListener('pointerover', handlePointerOver)
    scroller.addEventListener('pointermove', handlePointerMove)
    scroller.addEventListener('pointerout', handlePointerOut)
    scroller.addEventListener('pointerleave', endPointerInteraction)
    scroller.addEventListener('wheel', endPointerInteraction, { passive: true })
    scroller.addEventListener('scroll', handleScroll, { passive: true })
    table.addEventListener('focusin', handleFocusIn)
    table.addEventListener('focusout', handleFocusOut)
    table.addEventListener('keydown', handleKeyDown)

    return () => {
      scroller.removeEventListener('pointerover', handlePointerOver)
      scroller.removeEventListener('pointermove', handlePointerMove)
      scroller.removeEventListener('pointerout', handlePointerOut)
      scroller.removeEventListener('pointerleave', endPointerInteraction)
      scroller.removeEventListener('wheel', endPointerInteraction)
      scroller.removeEventListener('scroll', handleScroll)
      table.removeEventListener('focusin', handleFocusIn)
      table.removeEventListener('focusout', handleFocusOut)
      table.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    grid,
    endPointerInteraction,
    hideTooltip,
    highlightCell,
    positionTooltip,
    updateTooltip,
  ])

  return { scrollerRef, tableRef, tooltipRef, tooltip, activeCell }
}
