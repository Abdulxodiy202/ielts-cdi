// OpenRouter API helper -- OpenAI-compatible chat completions endpoint.
// Server-only: reads process.env.OPENROUTER_API_KEY, never exposed to the client.
//
// Model tanlash (kod o'zgartirmasdan, Vercel'da almashtirish mumkin):
// Vercel > ielts-cdi > Settings > Environment Variables > OPENROUTER_MODEL
//   - Bo'sh/mavjud bo'lmasa -> BEPUL model ishlatiladi (pastga qarang).
//   - Pullik modelga o'tish uchun shu o'zgaruvchiga masalan
//     "google/gemini-2.0-flash-001" qiymatini qo'shing va qayta deploy qiling.
//
// BEPUL (":free"): hisobingizda pul bo'lmasa ham ishlaydi, lekin
// OpenRouter tomonidan so'rovlar soni cheklangan (taxminan kuniga bir
// necha o'nlab so'rov; hisobingizga hech bo'lmasa bir marta $10
// to'ldirgan bo'lsangiz bu limit kuniga 1000 tagacha oshadi). Yuklama
// yuqori paytda javob sekinroq yoki vaqtinchalik band bo'lishi mumkin.
// 2026-08 holatiga ko'ra Gemini'ning o'zida endi bepul tarif yo'q --
// OpenRouter faqat ochiq modellarni bepul taqdim etadi, shuning uchun
// standart bepul modellar shular bo'ldi. Bepul modellar ro'yxati
// tez-tez o'zgaradi -- birontasi ishlamay qolsa, kod avtomatik
// ravishda qolganlarini sinab ko'radi.
//
// MUHIM: "openrouter/free" (avtomatik router) ataylab ro'yxatga
// QO'SHILMAGAN -- u ba'zan "fikrlovchi" (reasoning, masalan DeepSeek R1)
// modelga yo'naltirib qo'yadi, bunday model butun token byudjetini
// yashirin fikrlash uchun sarflab, YAKUNIY JAVOBNI BO'SH qaytarishi
// mumkin (aynan shunday sinovda kuzatilgan -- 40+ soniya kutib, "bo'sh
// javob" xatosi bilan tugagan edi). Shu sababdan "reasoning" deb
// belgilangan modellar (masalan *-inkling*, *-reasoning*) ham ataylab
// qo'shilmagan.
//
// TURLI TA'MINOTCHILAR (diversifikatsiya): 2026-08-31'da barcha 4 ta
// eski kandidat (2 ta Google Gemma, Z.ai GLM, Nvidia Nemotron-Ultra-550B)
// AYNAN BIR VAQTDA "temporarily rate-limited upstream" xatosi berdi --
// bu OpenRouter'ning eng mashhur bepul modellariga umumiy yuklama
// keskin oshib ketganini bildiradi (barchasi navbatda turgan boshqa
// foydalanuvchilar bilan bitta upstream limitni bo'lishadi). Shuning
// uchun kam mashhur (demak kamroq navbatga tushadigan) turli
// ta'minotchilardan (MiniMax, Nvidia'ning kichikroq varianti, Liquid AI)
// qo'shimcha kandidatlar qo'shildi -- barchasi BIR VAQTDA band bo'lish
// ehtimoli ancha kamayadi. Ulkan (550B) Nemotron-Ultra olib tashlandi --
// u real sinovlarda bir necha marta BO'SH javob qaytargan edi (katta
// model o'z navbatida token byudjetini "kesib" qo'yishi ehtimoli
// yuqoriroq); o'rniga ancha kichikroq (120B) Nemotron-Super qo'shildi.
//
// TEZLIK: bepul rejimda barcha kandidat modellarga PARALEL (bir vaqtda)
// so'rov yuboriladi va birinchi bo'lib to'g'ri javob qaytargani
// ishlatiladi -- ketma-ket urinish o'rniga (bu oldin bitta so'rovni
// 80 soniyagacha "osilib qolgan"day ko'rsatardi).
//
// PULLIK: deyarli hech qanday so'rov cheklovisiz, tezroq va barqaror
// javob beradi. Narxi juda arzon (Gemini Flash uchun 1000 ta reja
// generatsiyasi taxminan bir necha sent atrofida), lekin hisobingizda
// mablag' (kredit) bo'lishi shart -- aks holda so'rov xato beradi.
//
// SIFAT TEKSHIRUVI (opts.validate): Promise.any faqat "eng tezkor"
// javobni tanlaydi -- lekin tezroq/kichikroq model ba'zan yaroqsiz
// formatli (masalan noto'g'ri/kesilgan JSON) javob qaytarishi mumkin,
// shu bois "tez, lekin yaroqsiz" javob "sekinroq, lekin to'g'ri" javobni
// almashtirib qo'yishi mumkin edi. Chaqiruvchi `opts.validate` orqali
// javobni tekshiruvchi funksiya bersa, shu tekshiruvdan o'tmagan javob
// MUVAFFAQIYATSIZLIK deb hisoblanadi va Promise.any boshqa kandidatni
// kutishda davom etadi.
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const FREE_MODEL_CANDIDATES = [
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'z-ai/glm-5.2:free',
  'minimax/minimax-m3:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'liquid/lfm-2.5-2.6b:free',
]
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || FREE_MODEL_CANDIDATES[0]

// Bitta modelga so'rov yuborilganda ko'p kutib qolmaslik uchun (bepul
// modellar ba'zan uzoq "osilib" qoladi) -- shu vaqtdan keyin so'rov
// bekor qilinib, xato deb hisoblanadi.
const REQUEST_TIMEOUT_MS = 15_000

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

async function callOnce(apiKey: string, model: string, messages: OpenRouterMessage[], temperature: number, maxTokens: number, signal: AbortSignal) {
  return fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      // OpenRouter tavsiya qiladigan ixtiyoriy attribution header'lar.
      'HTTP-Referer': 'https://ielts-cdi.vercel.app',
      'X-Title': 'IELTS CDI',
    },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
    signal,
  })
}

// 429 uchun qayta urinish kutish vaqtlari (soniya emas, ms) -- upstream
// xabari odatda "retry shortly" deydi, shuning uchun 2-3 soniyalik
// oraliq band holat tarqalishi uchun yetarli bo'lishi kutiladi. Ikkita
// qayta urinish (jami 3 urinish) qo'shildi -- avval faqat 1 marta qayta
// urinilardi, lekin 2026-08-31'dagi kabi keng ko'lamli vaqtinchalik
// yuklamada bitta qisqa (1.2s) kutish yetarli bo'lmasligi mumkin.
const RETRY_DELAYS_MS = [1500, 3000]

/** Bitta modelni sinaydi (429 bo'lsa bir necha qisqa kutish + qayta
 *  urinish bilan), muvaffaqiyatsizlikda tavsifli Error tashlaydi.
 *  `validate` berilgan bo'lsa va javob shu tekshiruvdan o'tmasa (masalan
 *  chaqiruvchi kutgan JSON shaklida bo'lmasa), MUVAFFAQIYATSIZLIK deb
 *  hisoblanadi -- shunda Promise.any bu (tez, lekin noto'g'ri formatli)
 *  javobni "g'olib" deb tanlab qolmaydi, balki boshqa kandidat modelning
 *  (sekinroq bo'lsa ham TO'G'RI formatli) javobini kutadi. Avval har
 *  qanday BO'SH BO'LMAGAN matn "muvaffaqiyat" deb hisoblanardi -- shu
 *  sabab kichikroq/tezroq model ba'zan yaroqsiz JSON bilan g'olib chiqib,
 *  "AI noto'g'ri formatda javob qaytardi" xatosiga olib kelardi, garchi
 *  boshqa (biroz sekinroq) model to'g'ri JSON qaytargan bo'lsa ham. */
async function attemptModel(apiKey: string, model: string, messages: OpenRouterMessage[], temperature: number, maxTokens: number, validate?: (content: string) => boolean): Promise<string> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    let res: Response
    try {
      res = await callOnce(apiKey, model, messages, temperature, maxTokens, controller.signal)
    } catch (e) {
      clearTimeout(timer)
      const aborted = (e as { name?: string })?.name === 'AbortError'
      throw new Error(aborted
        ? `OpenRouter (${model}) ${REQUEST_TIMEOUT_MS / 1000}s ichida javob bermadi`
        : `OpenRouter (${model}) so'rovida tarmoq xatoligi: ${(e as Error)?.message || e}`)
    }
    clearTimeout(timer)

    if (res.ok) {
      const data = await res.json()
      const content = data?.choices?.[0]?.message?.content
      if (typeof content === 'string' && content.trim()) {
        const trimmed = content.trim()
        if (validate && !validate(trimmed)) {
          throw new Error(`OpenRouter (${model}) noto'g'ri/formatsiz (yoki kesilgan) javob qaytardi`)
        }
        return trimmed
      }
      const finishReason = data?.choices?.[0]?.finish_reason
      throw new Error(`OpenRouter (${model}) bo'sh javob qaytardi (finish_reason: ${finishReason ?? 'noma\'lum'})`)
    }

    if (res.status === 429 && attempt < RETRY_DELAYS_MS.length) {
      await new Promise(r => setTimeout(r, RETRY_DELAYS_MS[attempt]))
      continue
    }
    const text = await res.text().catch(() => '')
    throw new Error(`OpenRouter xatolik (${model}, ${res.status}): ${text.slice(0, 300)}`)
  }
  throw new Error(`OpenRouter (${model}): noma'lum xatolik`)
}

export async function callOpenRouter(
  messages: OpenRouterMessage[],
  opts?: { model?: string; temperature?: number; maxTokens?: number; validate?: (content: string) => boolean },
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY topilmadi (Vercel Environment Variables tekshiring)')

  const temperature = opts?.temperature ?? 0.7
  const maxTokens = opts?.maxTokens ?? 1200
  const validate = opts?.validate

  // Aniq model ko'rsatilgan bo'lsa (masalan pullik model) -- faqat
  // o'shani sinaymiz, ketma-ket (429'da bitta qayta urinish bilan).
  if (opts?.model) {
    return attemptModel(apiKey, opts.model, messages, temperature, maxTokens, validate)
  }

  // Bepul rejim: barcha kandidatlarga PARALEL so'rov yuboramiz va
  // BIRINCHI muvaffaqiyatli javobni darhol qaytaramiz (Promise.any) --
  // Promise.allSettled ISHLATILMAYDI, chunki u hammasi tugashini kutadi:
  // agar bitta model tez javob bersa-yu, boshqa (masalan katta 550B)
  // model bepul navbatda daqiqalab "osilib" qolsa, allSettled aynan
  // o'sha eng sekin modelni ham kutib o'tirar edi (aynan shu sabab
  // bitta so'rov 3+ daqiqaga cho'zilgan holat kuzatilgan edi).
  // Promise.any esa birinchi muvaffaqiyatli natijada darhol qaytadi,
  // qolgan sekin so'rovlar orqa fonda o'zicha tugaydi (natijasi
  // e'tiborga olinmaydi).
  const candidates = FREE_MODEL_CANDIDATES.includes(DEFAULT_MODEL)
    ? [DEFAULT_MODEL, ...FREE_MODEL_CANDIDATES.filter(m => m !== DEFAULT_MODEL)]
    : [DEFAULT_MODEL, ...FREE_MODEL_CANDIDATES]

  try {
    return await Promise.any(candidates.map(model => attemptModel(apiKey, model, messages, temperature, maxTokens, validate)))
  } catch (e) {
    const errors = ((e as AggregateError)?.errors ?? []).map((err: unknown) => (err as Error)?.message || String(err))
    errors.forEach(msg => console.warn('[openrouter]', msg))
    // Barcha xabarlarni birlashtirib tashlaymiz (faqat birinchisini emas)
    // -- shunda chaqiruvchi (masalan ai-generate/route.ts) xatolik
    // TURINI (429/band, yoki formatsiz javob, yoki tarmoq xatosi) to'g'ri
    // aniqlab, foydalanuvchiga mosroq xabar ko'rsata oladi.
    throw new Error(errors.join(' | ') || 'OpenRouter: barcha bepul modellar muvaffaqiyatsiz tugadi')
  }
}
