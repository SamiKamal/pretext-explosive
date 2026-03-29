import { prepareWithSegments, layoutWithLines, type PreparedTextWithSegments } from '@chenglou/pretext'

export type CharInfo = {
  char: string
  x: number
  y: number
  width: number
  lineIndex: number
}

const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

function getGraphemes(text: string): string[] {
  return Array.from(graphemeSegmenter.segment(text), s => s.segment)
}

export function computeCharPositions(
  text: string,
  font: string,
  maxWidth: number,
  lineHeight: number,
  offsetX: number,
  offsetY: number,
): { chars: CharInfo[]; prepared: PreparedTextWithSegments; totalHeight: number } {
  const prepared = prepareWithSegments(text, font)
  const result = layoutWithLines(prepared, maxWidth, lineHeight)
  const chars: CharInfo[] = []

  for (let lineIdx = 0; lineIdx < result.lines.length; lineIdx++) {
    const line = result.lines[lineIdx]!
    const startSeg = line.start.segmentIndex
    const startGrapheme = line.start.graphemeIndex
    const endSeg = line.end.segmentIndex
    const endGrapheme = line.end.graphemeIndex

    let x = offsetX
    const y = offsetY + lineIdx * lineHeight

    for (let si = startSeg; si <= endSeg && si < prepared.segments.length; si++) {
      const segment = prepared.segments[si]!
      const kind = prepared.kinds[si]!

      // Skip non-visible segments
      if (kind === 'hard-break') continue

      const graphemes = getGraphemes(segment)
      const segWidth = prepared.widths[si]!

      // Determine grapheme range within this segment for this line
      const gStart = si === startSeg ? startGrapheme : 0
      const gEnd = si === endSeg ? endGrapheme : graphemes.length

      if (kind === 'space' || kind === 'preserved-space' || kind === 'tab') {
        // For spaces, add a single space char entry with the full segment width
        if (gStart < gEnd) {
          const spaceWidth = segWidth / graphemes.length
          for (let gi = gStart; gi < gEnd; gi++) {
            chars.push({
              char: graphemes[gi]!,
              x,
              y,
              width: spaceWidth,
              lineIndex: lineIdx,
            })
            x += spaceWidth
          }
        }
        continue
      }

      // Text segments — use breakableWidths if available, else distribute evenly
      const breakable = prepared.breakableWidths[si]
      if (breakable && breakable.length === graphemes.length) {
        for (let gi = gStart; gi < gEnd; gi++) {
          const gw = breakable[gi]!
          chars.push({
            char: graphemes[gi]!,
            x,
            y,
            width: gw,
            lineIndex: lineIdx,
          })
          x += gw
        }
      } else {
        // Fallback: measure each grapheme via canvas
        // Or distribute width proportionally
        const charWidth = segWidth / graphemes.length
        for (let gi = gStart; gi < gEnd; gi++) {
          chars.push({
            char: graphemes[gi]!,
            x,
            y,
            width: charWidth,
            lineIndex: lineIdx,
          })
          x += charWidth
        }
      }
    }
  }

  return { chars, prepared, totalHeight: result.height }
}
