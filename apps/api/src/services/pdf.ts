import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'
import { existsSync } from 'fs'

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
}

const SIZES: Record<StickerSize, StickerDimensions> = {
  SMALL: {
    width: 142, height: 85,
    fontSize: { title: 9, body: 6.5, small: 5.5 },
    qrSize: 56, padding: 5, headerH: 14,
    columns: 1, rows: 1,
  },
  MEDIUM: {
    width: 284, height: 142,
    fontSize: { title: 14, body: 9, small: 7.5 },
    qrSize: 96, padding: 8, headerH: 22,
    columns: 1, rows: 1,
  },
  LARGE: {
    width: 425, height: 284,
    fontSize: { title: 20, body: 13, small: 10 },
    qrSize: 150, padding: 12, headerH: 32,
    columns: 1, rows: 1,
  },
  A4_SHEET: {
    width: 595, height: 842,
    fontSize: { title: 12, body: 8, small: 6.5 },
    qrSize: 80, padding: 7, headerH: 18,
    columns: 2, rows: 4,
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

const CJK_FONT = CJK_FONT_PATHS.find(existsSync)
const CJK_BOLD = CJK_BOLD_PATHS.find(existsSync)
const REGULAR = CJK_FONT ? 'CJKRegular' : 'Helvetica'
const BOLD = CJK_BOLD ? 'CJKBold' : (CJK_FONT ? 'CJKRegular' : 'Helvetica-Bold')

function registerFonts(doc: PDFKit.PDFDocument) {
  if (CJK_FONT) doc.registerFont('CJKRegular', CJK_FONT, 'NotoSansCJKtc-Regular')
  if (CJK_BOLD) doc.registerFont('CJKBold', CJK_BOLD, 'NotoSansCJKtc-Bold')
}

async function qrBuffer(url: string, size: number): Promise<Buffer> {
  // Generate at 4× for crisp rendering when PDF viewer scales the page
  return QRCode.toBuffer(url, { width: size * 4, margin: 2 })
}

function drawIdPill(doc: PDFKit.PDFDocument, id: string, x: number, y: number, fontSize: number) {
  const shortId = id.replace(/-/g, '').slice(0, 8).toUpperCase()
  const fs = fontSize * 0.8
  const pH = 3, pV = 1
  doc.font(REGULAR).fontSize(fs)
  const tw = doc.widthOfString(shortId)
  const pillW = tw + pH * 2
  const pillH = fs + pV * 2
  const r = pillH / 2
  doc.roundedRect(x, y, pillW, pillH, r).fill('#DE272C')
  doc.font(BOLD).fillColor('#ffffff').text(shortId, x + pH, y - pV * 0.5, { width: tw, lineBreak: false, lineGap: 0 })
  doc.fillColor('#000000')
}

// Shrink font until text fits in maxWidth; returns chosen size
function fitFontSize(doc: PDFKit.PDFDocument, text: string, maxWidth: number, startSize: number, minSize: number): number {
  let size = startSize
  doc.fontSize(size)
  while (doc.widthOfString(text) > maxWidth && size > minSize) {
    size -= 0.5
    doc.fontSize(size)
  }
  return size
}

// ─── Header bar ───────────────────────────────────────────────────────────────
function drawHeader(
  doc: PDFKit.PDFDocument,
  x: number, y: number, w: number, h: number,
  brandName: string,
  logoBuffer: Buffer | null,
  dim: StickerDimensions,
) {
  // Background
  doc.save()
  doc.rect(x, y, w, h).fill('#DE272C')
  doc.restore()

  const logoMaxH = h * 0.65
  const logoMaxW = h * 2.2
  let logoEndX = x + dim.padding

  if (logoBuffer) {
    try {
      doc.image(logoBuffer, x + dim.padding, y + (h - logoMaxH) / 2, {
        fit: [logoMaxW, logoMaxH],
      })
      // Estimate logo width after fit; use logoMaxW as upper bound
      logoEndX = x + dim.padding + logoMaxW + dim.padding * 0.5
    } catch {
      // ignore broken logo
    }
  }

  if (brandName) {
    const textY = y + (h - dim.fontSize.small) / 2 - 1
    doc
      .font(BOLD)
      .fontSize(dim.fontSize.small)
      .fillColor('#ffffff')
      .text(brandName, logoEndX, textY, {
        width: w - (logoEndX - x) - dim.padding,
        lineBreak: false,
        ellipsis: true,
      })
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
) {
  const { padding, fontSize, qrSize, headerH } = dim
  const contentY = y + headerH
  const contentH = dim.height - headerH
  const qrX = x + dim.width - qrSize - padding
  const textW = dim.width - qrSize - padding * 3

  // Border
  doc.rect(x, y, dim.width, dim.height).stroke('#d1d5db')

  // Header
  drawHeader(doc, x, y, dim.width, headerH, brandName, logoBuffer, dim)

  // QR code
  const qrUrl = `${appUrl}/boxes/${box.id}`
  const qr = await qrBuffer(qrUrl, qrSize)
  const qrY = contentY + (contentH - qrSize) / 2
  doc.image(qr, qrX, qrY, { width: qrSize })

  // Label — auto-shrink
  const labelText = box.label
  doc.font(BOLD)
  const titleSize = fitFontSize(doc, labelText, textW, fontSize.title * 1.8, fontSize.body)
  doc.text(labelText, x + padding, contentY + padding, {
    width: textW,
    lineBreak: false,
  })

  let lineY = contentY + padding + titleSize + padding * 0.6

  // Owner
  if (box.owner) {
    doc.font(REGULAR).fontSize(fontSize.body).fillColor('#374151')
      .text(`負責人  ${box.owner.name}`, x + padding, lineY, { width: textW, lineBreak: false, ellipsis: true })
    lineY += fontSize.body + 3
  }

  // ID pill
  drawIdPill(doc, box.id, x + padding, y + dim.height - padding - fontSize.small * 1.6, fontSize.small)

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
) {
  const { padding, fontSize, qrSize, headerH } = dim
  const contentY = y + headerH
  const contentH = dim.height - headerH
  const qrX = x + dim.width - qrSize - padding
  const textW = dim.width - qrSize - padding * 3

  doc.rect(x, y, dim.width, dim.height).stroke('#d1d5db')
  drawHeader(doc, x, y, dim.width, headerH, brandName, logoBuffer, dim)

  const qrUrl = `${appUrl}/items/${item.id}`
  const qr = await qrBuffer(qrUrl, qrSize)
  const qrY = contentY + (contentH - qrSize) / 2
  doc.image(qr, qrX, qrY, { width: qrSize })

  // Item name — auto-shrink
  doc.font(BOLD)
  const titleSize = fitFontSize(doc, item.name, textW, fontSize.title * 1.5, fontSize.body)
  doc.text(item.name, x + padding, contentY + padding, { width: textW, lineBreak: false, ellipsis: true })

  let lineY = contentY + padding + titleSize + padding * 0.6

  // Owner
  if (item.owner) {
    doc.font(REGULAR).fontSize(fontSize.body).fillColor('#374151')
      .text(`負責人  ${item.owner.name}`, x + padding, lineY, { width: textW, lineBreak: false, ellipsis: true })
    lineY += fontSize.body + 3
  }

  // Group + Box
  const meta: string[] = []
  if (item.group) meta.push(item.group.name)
  if (item.box) meta.push(`箱 ${item.box.label}`)
  if (meta.length > 0) {
    doc.font(REGULAR).fontSize(fontSize.small).fillColor('#6b7280')
      .text(meta.join('  ·  '), x + padding, lineY, { width: textW, lineBreak: false, ellipsis: true })
    lineY += fontSize.small + 2
  }

  // Tags
  if (item.tags.length > 0) {
    doc.font(REGULAR).fontSize(fontSize.small).fillColor('#9ca3af')
      .text(item.tags.slice(0, 5).join('  ·  '), x + padding, lineY, { width: textW, lineBreak: false, ellipsis: true })
  }

  // ID pill
  drawIdPill(doc, item.id, x + padding, y + dim.height - padding - fontSize.small * 1.6, fontSize.small)

  doc.fillColor('#000000')
}

// ─── PDF builders ─────────────────────────────────────────────────────────────
export async function generateBoxStickerPdf(
  boxes: Parameters<typeof drawBoxLabel>[1][],
  appUrl: string,
  size: StickerSize,
  logoBuffer: Buffer | null = null,
  brandName = '',
): Promise<Buffer> {
  const dim = SIZES[size]
  const isA4 = size === 'A4_SHEET'

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const doc = new PDFDocument({
      size: isA4 ? 'A4' : [dim.width, dim.height],
      margins: { top: 0, left: 0, right: 0, bottom: 0 },
      autoFirstPage: false,
    })
    registerFonts(doc)
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
            await drawBoxLabel(doc, page[j], appUrl, col * cellW, row * cellH, { ...dim, width: cellW, height: cellH }, logoBuffer, brandName)
          }
        }
      } else {
        for (const box of boxes) {
          doc.addPage()
          await drawBoxLabel(doc, box, appUrl, 0, 0, dim, logoBuffer, brandName)
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
): Promise<Buffer> {
  const dim = SIZES[size]
  const isA4 = size === 'A4_SHEET'

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const doc = new PDFDocument({
      size: isA4 ? 'A4' : [dim.width, dim.height],
      margins: { top: 0, left: 0, right: 0, bottom: 0 },
      autoFirstPage: false,
    })
    registerFonts(doc)
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
            await drawItemLabel(doc, page[j], appUrl, col * cellW, row * cellH, { ...dim, width: cellW, height: cellH }, logoBuffer, brandName)
          }
        }
      } else {
        for (const item of items) {
          doc.addPage()
          await drawItemLabel(doc, item, appUrl, 0, 0, dim, logoBuffer, brandName)
        }
      }
      doc.end()
    }
    run().catch(reject)
  })
}
