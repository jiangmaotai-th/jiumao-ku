const UA = 'maotaiworks-daily/1.0'

export function chatCompletionsUrl(base) {
  const trimmed = String(base || '').replace(/\/$/, '')
  if (/\/chat\/completions$/.test(trimmed)) return trimmed
  return `${trimmed}/chat/completions`
}

function stripFence(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return (fenced ? fenced[1] : text).trim()
}

/**
 * OpenAI-compatible client. available is false when no real API key is set.
 * completeJson throws on transport and parse failures so callers can publish
 * the source-text fallback.
 */
export function createLlm(env) {
  const available = Boolean(env.llmApiKey)
  return {
    available,
    unavailableReason: available ? '' : 'no-api-key',
    model: env.llmModel,
    async completeJson({ system, user, maxTokens = 4096, purpose = 'json' }) {
      if (!available) {
        const error = new Error('no-api-key')
        error.code = 'no-api-key'
        throw error
      }
      const url = chatCompletionsUrl(env.llmBaseUrl)
      let lastError = null
      for (let attempt = 0; attempt < 2; attempt++) {
        const useFormat = attempt === 0
        try {
          return await requestOnce({
            url,
            key: env.llmApiKey,
            model: env.llmModel,
            system,
            user,
            maxTokens,
            purpose,
            useFormat,
          })
        } catch (error) {
          lastError = error
          const retryable = error.status === 400 || error.status === 429 || (error.status >= 500 && error.status <= 599)
          if (!retryable || attempt === 1) break
        }
      }
      throw lastError
    },
  }
}

async function requestOnce({ url, key, model, system, user, maxTokens, purpose, useFormat }) {
  const body = {
    model,
    temperature: purpose.includes('translate') ? 0.1 : 0.2,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  }
  if (useFormat) body.response_format = { type: 'json_object' }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 90000)
  try {
    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'User-Agent': UA,
      },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      const error = new Error(`llm ${response.status} ${purpose}`)
      error.status = response.status
      throw error
    }
    const payload = await response.json()
    const choice = payload.choices?.[0]
    if (choice?.finish_reason === 'length') {
      const error = new Error(`llm truncated ${purpose}`)
      error.status = 0
      throw error
    }
    const content = choice?.message?.content
    if (typeof content !== 'string' || !content.trim()) {
      const error = new Error(`llm empty ${purpose}`)
      error.status = 0
      throw error
    }
    try {
      return JSON.parse(stripFence(content))
    } catch {
      const error = new Error(`llm invalid-json ${purpose}`)
      error.status = 0
      throw error
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeout = new Error(`llm timeout ${purpose}`)
      timeout.status = 0
      throw timeout
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}
