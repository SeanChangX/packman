import axios from 'axios'
import sharp from 'sharp'
import { prisma } from '../plugins/prisma'

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_VISION_MODEL ?? 'llava'

const TAG_PROMPT =
  '請用繁體中文列出這個物品的5個簡短標籤，只需要輸出標籤，用逗號分隔，不要有其他說明。例如：電子設備, 充電器, 攜帶型, 黑色, 科技'

async function prepareImage(buffer: Buffer): Promise<string> {
  const resized = await sharp(buffer)
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()
  return resized.toString('base64')
}

export async function triggerAiTagging(itemId: string, imageBuffer: Buffer): Promise<void> {
  try {
    const base64Image = await prepareImage(imageBuffer)

    const response = await axios.post<{ response: string }>(
      `${OLLAMA_BASE_URL}/api/generate`,
      {
        model: OLLAMA_MODEL,
        prompt: TAG_PROMPT,
        images: [base64Image],
        stream: false,
      },
      { timeout: 60_000 }
    )

    const rawText = response.data.response.trim()
    const tags = rawText
      .split(/[,，、]/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0 && t.length <= 30)
      .slice(0, 8)

    await prisma.item.update({
      where: { id: itemId },
      data: { tags, aiTagStatus: 'DONE' },
    })
  } catch (err) {
    await prisma.item.update({
      where: { id: itemId },
      data: { aiTagStatus: 'FAILED' },
    })
    throw err
  }
}
