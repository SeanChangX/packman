import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'
import { existsSync } from 'fs'
import path from 'path'
import { tFor, type ApiLocale, DEFAULT_LOCALE } from '../lib/i18n'

type StickerSize = 'SMALL' | 'MEDIUM' | 'LARGE' | 'A4_SHEET'

interface StickerDimensions {
  width: number
  height: number
  fontSize: { title: number; body: number; small: number }
  qrSize: number
  padding: number
  headerH: number
  columns: number
  rows: number
  qrScale: number
}

const SIZES: Record<StickerSize, StickerDimensions> = {
  SMALL: {
    width: 142, height: 85,
    fontSize: { title: 9, body: 6.5, small: 5.5 },
    qrSize: 56, padding: 5, headerH: 14,
    columns: 1, rows: 1, qrScale: 8,
  },
  MEDIUM: {
    width: 284, height: 142,
    fontSize: { title: 14, body: 9, small: 7.5 },
    qrSize: 96, padding: 8, headerH: 22,
    columns: 1, rows: 1, qrScale: 6,
  },
  LARGE: {
    width: 425, height: 284,
    fontSize: { title: 23, body: 15, small: 12 },
    qrSize: 168, padding: 12, headerH: 46,
    columns: 1, rows: 1, qrScale: 4,
  },
  A4_SHEET: {
    width: 595, height: 842,
    fontSize: { title: 15, body: 10, small: 8 },
    qrSize: 92, padding: 7, headerH: 28,
    columns: 2, rows: 4, qrScale: 4,
  },
}

const CJK_FONT_PATHS = [
  '/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc',
  '/usr/share/fonts/noto/NotoSansCJK-Regular.ttc',
  '/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.otf',
]
const CJK_BOLD_PATHS = [
  '/usr/share/fonts/noto-cjk/NotoSansCJK-Bold.ttc',
  '/usr/share/fonts/noto/NotoSansCJK-Bold.ttc',
  '/usr/share/fonts/noto-cjk/NotoSansCJK-Bold.otf',
]

const MSTIFF_PATH = path.join(__dirname, '../../fonts/MStiffHei_HK_UltraBold.ttf')

const CJK_FONT = CJK_FONT_PATHS.find(existsSync)
const CJK_BOLD = CJK_BOLD_PATHS.find(existsSync)
const HAS_MSTIFF = existsSync(MSTIFF_PATH)

const REGULAR = CJK_FONT ? 'CJKRegular' : 'Helvetica'
const BOLD = CJK_BOLD ? 'CJKBold' : (CJK_FONT ? 'CJKRegular' : 'Helvetica-Bold')

function registerFonts(doc: PDFKit.PDFDocument): string {
  if (CJK_FONT) doc.registerFont('CJKRegular', CJK_FONT, 'NotoSansCJKtc-Regular')
  if (CJK_BOLD) doc.registerFont('CJKBold', CJK_BOLD, 'NotoSansCJKtc-Bold')
  if (HAS_MSTIFF) {
    try {
      doc.registerFont('MStiffHei', MSTIFF_PATH)
      return 'MStiffHei'
    } catch {
      // WOFF2 failed to load; fall through to BOLD
    }
  }
  return BOLD
}

function formatPrintDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

async function qrBuffer(url: string, size: number, scale = 4): Promise<Buffer> {
  return QRCode.toBuffer(url, { width: size * scale, margin: 2 })
}

function drawIdPill(doc: PDFKit.PDFDocument, id: string, x: number, y: number, fontSize: number) {
  const shortId = id.replace(/-/g, '').slice(0, 8).toUpperCase()
  const fs = fontSize * 1.05
  const pH = fs * 0.55
  const pV = fs * 0.28
  doc.font(BOLD).fontSize(fs)
  const tw = doc.widthOfString(shortId)
  const pillW = tw + pH * 2
  const pillH = fs + pV * 2
  const r = pillH / 2
  const textH = doc.heightOfString(shortId, { width: tw, lineBreak: false, lineGap: 0 })
  const textY = y + (pillH - textH) / 2 - fs * 0.08
  doc.roundedRect(x, y, pillW, pillH, r).fill('#DE272C')
  doc.fillColor('#ffffff').text(shortId, x + pH, textY, { width: tw, lineBreak: false, lineGap: 0 })
  doc.fillColor('#000000')
}

function idPillHeight(fontSize: number) {
  const fs = fontSize * 1.05
  return fs + fs * 0.28 * 2
}

function fitFontSize(doc: PDFKit.PDFDocument, text: string, maxWidth: number, startSize: number, minSize: number): number {
  let size = startSize
  doc.fontSize(size)
  while (doc.widthOfString(text) > maxWidth && size > minSize) {
    size -= 0.5
    doc.fontSize(size)
  }
  return size
}

function fitSingleLineText(doc: PDFKit.PDFDocument, text: string, maxWidth: number) {
  const safeMax = maxWidth - 0.5
  let label = text.trim().slice(0, 24)
  if (doc.widthOfString(label) <= safeMax) return label

  while (label.length > 0 && doc.widthOfString(`${label}...`) > safeMax) {
    label = label.slice(0, -1)
  }
  return label ? `${label}...` : ''
}

function labelLayout(x: number, dim: StickerDimensions) {
  const { padding, qrSize } = dim
  const sideInset = dim.width >= 400
    ? padding * 2
    : dim.columns > 1
      ? padding * 2
      : padding
  const gap = padding
  const textX = x + sideInset
  const qrX = x + dim.width - qrSize - sideInset
  const textW = Math.max(qrX - textX - gap, dim.width * 0.35)
  return { textX, qrX, textW }
}

function drawTagPills(
  doc: PDFKit.PDFDocument,
  tags: string[],
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number,
  maxY = Infinity,
) {
  const visibleTags = tags.slice(0, 5)
  const fs = fontSize * 0.8
  const pH = fs * 0.45
  const pV = fs * 0.22
  const pillH = fs + pV * 2
  const gap = fs * 0.45
  let cursorX = x
  let cursorY = y
  let rows = 1

  doc.font(BOLD).fontSize(fs)
  const lineH = doc.currentLineHeight(true)

  for (const tag of visibleTags) {
    const availTextW = Math.max(1, maxWidth - pH * 2)
    const label = fitSingleLineText(doc, tag, availTextW)
    if (!label) continue
    const textW = Math.min(doc.widthOfString(label), availTextW)
    const pillW = textW + pH * 2

    if (cursorX > x && cursorX + pillW > x + maxWidth) {
      if (rows >= 2) break
      rows += 1
      cursorX = x
      cursorY += pillH + gap
    }

    if (cursorY + pillH > maxY) break

    const textY = cursorY + (pillH - lineH) / 2 - fs * 0.08

    doc.roundedRect(cursorX, cursorY, pillW, pillH, pillH / 2).fill('#8b95a1')
    doc.save()
    doc.rect(cursorX, cursorY, pillW, pillH).clip()
    doc.fillColor('#ffffff')
      .text(label, cursorX + pH, textY, { lineBreak: false, lineGap: 0 })
    doc.restore()
    doc.font(BOLD).fontSize(fs)
    cursorX += pillW + gap
  }

  doc.fillColor('#000000')
}

// ─── Header bar ───────────────────────────────────────────────────────────────
function drawHeader(
  doc: PDFKit.PDFDocument,
  x: number, y: number, w: number, h: number,
  brandName: string,
  logoBuffer: Buffer | null,
  dim: StickerDimensions,
  printDate: string,
  headerFont: string,
) {
  doc.save()
  doc.rect(x, y, w, h).fill('#DE272C')
  doc.restore()

  const leftX = x + dim.padding
  const rightX = x + w - dim.padding

  // Shear factor for forward-italic slant on banner text (positive = top leans right)
  const slant = -0.2

  const headerFontSize = Math.min(h * 0.52, dim.fontSize.small * 1.45)
  doc.font(headerFont).fontSize(headerFontSize)
  const dateW = doc.widthOfString(printDate)
  const dateTextH = doc.heightOfString(printDate, { width: dateW, lineBreak: false, lineGap: 0 })
  const dateY = y + (h - dateTextH) / 2 - headerFontSize * 0.08

  // Draw date with slant anchored at text top so top edge stays flush right
  doc.save()
  doc.transform(1, 0, slant, 1, -slant * dateY, 0)
  doc.fillColor('#ffffff').text(printDate, rightX - dateW, dateY, {
    width: dateW,
    lineBreak: false,
    lineGap: 0,
  })
  doc.restore()

  let brandX = leftX
  if (logoBuffer) {
    const logoH = h * 0.88
    const logoW = h * 0.88
    try {
      doc.image(logoBuffer, leftX, y + (h - logoH) / 2, {
        fit: [logoW, logoH],
      })
      brandX = leftX + logoW + dim.padding * 0.5
    } catch {
      brandX = leftX
    }
  }

  if (brandName) {
    const textW = Math.max(1, rightX - dateW - dim.padding - brandX)
    doc.font(headerFont).fontSize(headerFontSize)
    const textH = doc.heightOfString(brandName, { width: textW, lineBreak: false, lineGap: 0 })
    const textY = y + (h - textH) / 2 - headerFontSize * 0.08

    // Draw brand name with same slant
    doc.save()
    doc.transform(1, 0, slant, 1, -slant * textY, 0)
    doc.fillColor('#ffffff')
      .text(brandName, brandX, textY, {
        width: textW,
        lineBreak: false,
        ellipsis: true,
        lineGap: 0,
      })
    doc.restore()
  }

  doc.fillColor('#000000')
}

// ─── Box label ────────────────────────────────────────────────────────────────
async function drawBoxLabel(
  doc: PDFKit.PDFDocument,
  box: { id: string; label: string; owner?: { name: string; email?: string | null } | null; _count?: { items: number } },
  appUrl: string,
  x: number, y: number,
  dim: StickerDimensions,
  logoBuffer: Buffer | null,
  brandName: string,
  printDate: string,
  headerFont: string,
  ownerLabel: string,
) {
  const { padding, fontSize, qrSize, headerH } = dim
  const contentY = y + headerH
  const contentH = dim.height - headerH
  const { textX, qrX, textW } = labelLayout(x, dim)

  doc.rect(x, y, dim.width, dim.height).stroke('#d1d5db')
  drawHeader(doc, x, y, dim.width, headerH, brandName, logoBuffer, dim, printDate, headerFont)

  const qrUrl = `${appUrl}/boxes/${box.id}`
  const qr = await qrBuffer(qrUrl, qrSize, dim.qrScale)
  const qrY = contentY + (contentH - qrSize) / 2
  doc.image(qr, qrX, qrY, { width: qrSize })

  const labelText = box.label
  doc.font(BOLD)
  fitFontSize(doc, labelText, textW, fontSize.title * 1.8, fontSize.body)
  doc.text(labelText, textX, contentY + padding, {
    width: textW,
    lineBreak: false,
    ellipsis: true,
  })
  const titleH = doc.heightOfString(labelText, { width: textW, lineBreak: false, lineGap: 0 })

  let lineY = contentY + padding + titleH + padding * 0.75

  if (box.owner) {
    const ownerText = `${ownerLabel}  ${box.owner.name}`
    doc.font(REGULAR).fontSize(fontSize.body).fillColor('#374151')
      .text(ownerText, textX, lineY, { width: textW, lineBreak: false, ellipsis: true })
    const ownerH = doc.heightOfString(ownerText, { width: textW, lineBreak: false, lineGap: 0 })
    lineY += ownerH + padding * 0.5
  }

  drawIdPill(doc, box.id, x + padding, y + dim.height - padding - idPillHeight(fontSize.small), fontSize.small)

  doc.fillColor('#000000')
}

// ─── Item label ───────────────────────────────────────────────────────────────
async function drawItemLabel(
  doc: PDFKit.PDFDocument,
  item: {
    id: string; name: string
    owner?: { name: string; email?: string | null } | null
    group?: { name: string; color?: string | null } | null
    box?: { label: string } | null
    tags: string[]
  },
  appUrl: string,
  x: number, y: number,
  dim: StickerDimensions,
  logoBuffer: Buffer | null,
  brandName: string,
  printDate: string,
  headerFont: string,
  ownerLabel: string,
) {
  const { padding, fontSize, qrSize, headerH } = dim
  const contentY = y + headerH
  const contentH = dim.height - headerH
  const { textX, qrX, textW } = labelLayout(x, dim)

  doc.rect(x, y, dim.width, dim.height).stroke('#d1d5db')
  drawHeader(doc, x, y, dim.width, headerH, brandName, logoBuffer, dim, printDate, headerFont)

  const qrUrl = `${appUrl}/items/${item.id}`
  const qr = await qrBuffer(qrUrl, qrSize, dim.qrScale)
  const qrY = contentY + (contentH - qrSize) / 2
  doc.image(qr, qrX, qrY, { width: qrSize })

  doc.font(BOLD)
  fitFontSize(doc, item.name, textW, fontSize.title * 1.5, fontSize.body)
  doc.text(item.name, textX, contentY + padding, { width: textW, lineBreak: false, ellipsis: true })
  const titleH = doc.heightOfString(item.name, { width: textW, lineBreak: false, lineGap: 0 })

  let lineY = contentY + padding + titleH + padding * 0.65

  if (item.owner) {
    const ownerText = `${ownerLabel}  ${item.owner.name}`
    doc.font(REGULAR).fontSize(fontSize.body).fillColor('#374151')
      .text(ownerText, textX, lineY, { width: textW, lineBreak: false, ellipsis: true })
    const ownerH = doc.heightOfString(ownerText, { width: textW, lineBreak: false, lineGap: 0 })
    lineY += ownerH + padding * 0.45
  }

  const meta: string[] = []
  if (item.group) meta.push(item.group.name)
  if (item.box) meta.push(item.box.label)
  if (meta.length > 0) {
    doc.font(REGULAR).fontSize(fontSize.small).fillColor('#6b7280')
      .text(meta.join('  ·  '), textX, lineY, { width: textW, lineBreak: false, ellipsis: true })
    const metaText = meta.join('  ·  ')
    const metaH = doc.heightOfString(metaText, { width: textW, lineBreak: false, lineGap: 0 })
    lineY += metaH + padding * 0.35
  } else {
    lineY += padding * 0.2
  }

  if (item.tags.length > 0) {
    const idPillH = idPillHeight(fontSize.small)
    const tagMaxY = y + dim.height - padding - idPillH - padding * 0.3
    drawTagPills(doc, item.tags, textX, lineY, textW, fontSize.small, tagMaxY)
  }

  drawIdPill(doc, item.id, x + padding, y + dim.height - padding - idPillHeight(fontSize.small), fontSize.small)

  doc.fillColor('#000000')
}

// ─── PDF builders ─────────────────────────────────────────────────────────────
export async function generateBoxStickerPdf(
  boxes: Parameters<typeof drawBoxLabel>[1][],
  appUrl: string,
  size: StickerSize,
  logoBuffer: Buffer | null = null,
  brandName = '',
  locale: ApiLocale = DEFAULT_LOCALE,
): Promise<Buffer> {
  const dim = SIZES[size]
  const isA4 = size === 'A4_SHEET'
  const printDate = formatPrintDate()
  const ownerLabel = tFor(locale)('pdf.label.owner')

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const doc = new PDFDocument({
      size: isA4 ? 'A4' : [dim.width, dim.height],
      margins: { top: 0, left: 0, right: 0, bottom: 0 },
      autoFirstPage: false,
    })
    const headerFont = registerFonts(doc)
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const run = async () => {
      if (isA4) {
        const cellW = Math.floor(dim.width / dim.columns)
        const cellH = Math.floor(dim.height / dim.rows)
        const perPage = dim.columns * dim.rows
        for (let i = 0; i < boxes.length; i += perPage) {
          doc.addPage()
          const page = boxes.slice(i, i + perPage)
          for (let j = 0; j < page.length; j++) {
            const col = j % dim.columns
            const row = Math.floor(j / dim.columns)
            await drawBoxLabel(doc, page[j], appUrl, col * cellW, row * cellH, { ...dim, width: cellW, height: cellH }, logoBuffer, brandName, printDate, headerFont, ownerLabel)
          }
        }
      } else {
        for (const box of boxes) {
          doc.addPage()
          await drawBoxLabel(doc, box, appUrl, 0, 0, dim, logoBuffer, brandName, printDate, headerFont, ownerLabel)
        }
      }
      doc.end()
    }
    run().catch(reject)
  })
}

export async function generateItemStickerPdf(
  items: Parameters<typeof drawItemLabel>[1][],
  appUrl: string,
  size: StickerSize,
  logoBuffer: Buffer | null = null,
  brandName = '',
  locale: ApiLocale = DEFAULT_LOCALE,
): Promise<Buffer> {
  const dim = SIZES[size]
  const isA4 = size === 'A4_SHEET'
  const printDate = formatPrintDate()
  const ownerLabel = tFor(locale)('pdf.label.owner')

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const doc = new PDFDocument({
      size: isA4 ? 'A4' : [dim.width, dim.height],
      margins: { top: 0, left: 0, right: 0, bottom: 0 },
      autoFirstPage: false,
    })
    const headerFont = registerFonts(doc)
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const run = async () => {
      if (isA4) {
        const cellW = Math.floor(dim.width / dim.columns)
        const cellH = Math.floor(dim.height / dim.rows)
        const perPage = dim.columns * dim.rows
        for (let i = 0; i < items.length; i += perPage) {
          doc.addPage()
          const page = items.slice(i, i + perPage)
          for (let j = 0; j < page.length; j++) {
            const col = j % dim.columns
            const row = Math.floor(j / dim.columns)
            await drawItemLabel(doc, page[j], appUrl, col * cellW, row * cellH, { ...dim, width: cellW, height: cellH }, logoBuffer, brandName, printDate, headerFont, ownerLabel)
          }
        }
      } else {
        for (const item of items) {
          doc.addPage()
          await drawItemLabel(doc, item, appUrl, 0, 0, dim, logoBuffer, brandName, printDate, headerFont, ownerLabel)
        }
      }
      doc.end()
    }
    run().catch(reject)
  })
}
