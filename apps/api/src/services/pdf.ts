import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'

type StickerSize = 'SMALL' | 'MEDIUM' | 'LARGE' | 'A4_SHEET'

interface StickerDimensions {
  width: number  // points (1pt = 1/72 inch)
  height: number
  fontSize: { title: number; subtitle: number; small: number }
  qrSize: number
  padding: number
  columns: number
  rows: number
}

const SIZES: Record<StickerSize, StickerDimensions> = {
  SMALL: {   // ~50×30mm
    width: 142, height: 85,
    fontSize: { title: 10, subtitle: 7, small: 6 },
    qrSize: 60, padding: 6, columns: 1, rows: 1,
  },
  MEDIUM: {  // ~100×50mm
    width: 284, height: 142,
    fontSize: { title: 14, subtitle: 10, small: 8 },
    qrSize: 100, padding: 10, columns: 1, rows: 1,
  },
  LARGE: {   // ~150×100mm
    width: 425, height: 284,
    fontSize: { title: 18, subtitle: 12, small: 10 },
    qrSize: 150, padding: 14, columns: 1, rows: 1,
  },
  A4_SHEET: {  // A4 with 2×4 grid of ~95×65mm labels
    width: 595, height: 842,
    fontSize: { title: 11, subtitle: 8, small: 7 },
    qrSize: 80, padding: 8, columns: 2, rows: 4,
  },
}

async function qrBuffer(url: string, size: number): Promise<Buffer> {
  return QRCode.toBuffer(url, { width: size, margin: 1 })
}

async function drawItemLabel(
  doc: PDFKit.PDFDocument,
  item: { id: string; name: string; owner?: { name: string; email?: string | null } | null; group?: { name: string } | null; box?: { label: string } | null; tags: string[] },
  appUrl: string,
  x: number,
  y: number,
  dim: StickerDimensions
) {
  const { padding, fontSize, qrSize } = dim
  const qrUrl = `${appUrl}/items/${item.id}`
  const qr = await qrBuffer(qrUrl, qrSize)

  // Border
  doc.rect(x, y, dim.width, dim.height).stroke('#cccccc')

  // Title
  doc
    .font('Helvetica-Bold')
    .fontSize(fontSize.title)
    .text(item.name, x + padding, y + padding, {
      width: dim.width - qrSize - padding * 3,
      height: fontSize.title + 4,
      ellipsis: true,
    })

  let lineY = y + padding + fontSize.title + 4

  // Owner
  if (item.owner) {
    doc
      .font('Helvetica')
      .fontSize(fontSize.subtitle)
      .text(`👤 ${item.owner.name}`, x + padding, lineY, {
        width: dim.width - qrSize - padding * 3,
      })
    lineY += fontSize.subtitle + 3
  }

  // Group + Box
  const meta = [item.group?.name, item.box ? `箱 ${item.box.label}` : undefined]
    .filter(Boolean)
    .join('  |  ')
  if (meta) {
    doc
      .font('Helvetica')
      .fontSize(fontSize.small)
      .fillColor('#555555')
      .text(meta, x + padding, lineY, { width: dim.width - qrSize - padding * 3 })
    lineY += fontSize.small + 3
  }

  // Tags
  if (item.tags.length > 0) {
    doc
      .fontSize(fontSize.small)
      .fillColor('#888888')
      .text(item.tags.slice(0, 4).join(' · '), x + padding, lineY, {
        width: dim.width - qrSize - padding * 3,
      })
  }

  // QR Code (right side)
  doc.image(qr, x + dim.width - qrSize - padding, y + padding, { width: qrSize, height: qrSize })

  doc.fillColor('#000000')
}

async function drawBoxLabel(
  doc: PDFKit.PDFDocument,
  box: { id: string; label: string; owner?: { name: string; email?: string | null } | null; _count?: { items: number } },
  appUrl: string,
  x: number,
  y: number,
  dim: StickerDimensions
) {
  const { padding, fontSize, qrSize } = dim
  const qrUrl = `${appUrl}/boxes/${box.id}`
  const qr = await qrBuffer(qrUrl, qrSize)

  doc.rect(x, y, dim.width, dim.height).stroke('#cccccc')

  // Large box label
  doc
    .font('Helvetica-Bold')
    .fontSize(fontSize.title * 2)
    .text(`箱 ${box.label}`, x + padding, y + padding, {
      width: dim.width - qrSize - padding * 3,
    })

  let lineY = y + padding + fontSize.title * 2 + 6

  if (box.owner) {
    doc
      .font('Helvetica')
      .fontSize(fontSize.subtitle)
      .text(`負責人: ${box.owner.name}`, x + padding, lineY, {
        width: dim.width - qrSize - padding * 3,
      })
    lineY += fontSize.subtitle + 3
  }

  if (box.owner?.email) {
    doc
      .font('Helvetica')
      .fontSize(fontSize.small)
      .fillColor('#555555')
      .text(box.owner.email, x + padding, lineY, {
        width: dim.width - qrSize - padding * 3,
      })
    lineY += fontSize.small + 3
  }

  if (box._count) {
    doc
      .fontSize(fontSize.small)
      .fillColor('#888888')
      .text(`物品數量: ${box._count.items}`, x + padding, lineY)
  }

  doc.image(qr, x + dim.width - qrSize - padding, y + padding, { width: qrSize, height: qrSize })
  doc.fillColor('#000000')
}

export async function generateItemStickerPdf(
  items: Parameters<typeof drawItemLabel>[1][],
  appUrl: string,
  size: StickerSize
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
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    if (isA4) {
      const cellW = Math.floor(dim.width / dim.columns)
      const cellH = Math.floor(dim.height / dim.rows)
      const perPage = dim.columns * dim.rows

      const drawPage = async (pageItems: typeof items) => {
        doc.addPage()
        for (let i = 0; i < pageItems.length; i++) {
          const col = i % dim.columns
          const row = Math.floor(i / dim.columns)
          await drawItemLabel(doc, pageItems[i], appUrl, col * cellW, row * cellH, {
            ...dim,
            width: cellW,
            height: cellH,
          })
        }
      }

      const run = async () => {
        for (let i = 0; i < items.length; i += perPage) {
          await drawPage(items.slice(i, i + perPage))
        }
        doc.end()
      }
      run().catch(reject)
    } else {
      const run = async () => {
        for (const item of items) {
          doc.addPage()
          await drawItemLabel(doc, item, appUrl, 0, 0, dim)
        }
        doc.end()
      }
      run().catch(reject)
    }
  })
}

export async function generateBoxStickerPdf(
  boxes: Parameters<typeof drawBoxLabel>[1][],
  appUrl: string,
  size: StickerSize
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
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    if (isA4) {
      const cellW = Math.floor(dim.width / dim.columns)
      const cellH = Math.floor(dim.height / dim.rows)
      const perPage = dim.columns * dim.rows

      const run = async () => {
        for (let i = 0; i < boxes.length; i += perPage) {
          doc.addPage()
          const page = boxes.slice(i, i + perPage)
          for (let j = 0; j < page.length; j++) {
            const col = j % dim.columns
            const row = Math.floor(j / dim.columns)
            await drawBoxLabel(doc, page[j], appUrl, col * cellW, row * cellH, {
              ...dim,
              width: cellW,
              height: cellH,
            })
          }
        }
        doc.end()
      }
      run().catch(reject)
    } else {
      const run = async () => {
        for (const box of boxes) {
          doc.addPage()
          await drawBoxLabel(doc, box, appUrl, 0, 0, dim)
        }
        doc.end()
      }
      run().catch(reject)
    }
  })
}
