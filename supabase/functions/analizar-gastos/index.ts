import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// llama-3.1-8b-instant fue descontinuado por Groq el 16/08/2026 para cuentas no-enterprise;
// openai/gpt-oss-20b es el reemplazo recomendado por Groq para ese tier.
const MODELO = 'openai/gpt-oss-20b'

async function llamarGroq(groqApiKey: string, prompt: string, maxTokens: number, intentos = 2) {
  for (let intento = 1; intento <= intentos; intento++) {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODELO,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
    })
    if (groqRes.ok) {
      const groqData = await groqRes.json()
      return groqData.choices?.[0]?.message?.content || 'Sin respuesta'
    }
    const err = await groqRes.text()
    // Rate limit (429): esperar un poco y reintentar una vez antes de fallar.
    if (groqRes.status === 429 && intento < intentos) {
      await new Promise(r => setTimeout(r, 3000))
      continue
    }
    throw new Error('Error de Groq: ' + err)
  }
  throw new Error('Error de Groq: sin respuesta tras reintentos')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Verificar autenticación
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers: corsHeaders })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers: corsHeaders })

    const body = await req.json()
    const modo = body.modo || 'resumen'

    const groqApiKey = Deno.env.get('GROQ_API_KEY')
    if (!groqApiKey) return new Response(JSON.stringify({ error: 'API key de Groq no configurada' }), { status: 500, headers: corsHeaders })

    let analisis: string

    if (modo === 'chat') {
      // Chat conversacional + proyecciones: recibe agregados mensuales ya calculados en el
      // cliente (nunca movimientos individuales) para minimizar tokens y no exponer conceptos
      // de texto libre que puedan tener información sensible.
      const { pregunta, resumenMensual } = body
      if (!pregunta || !resumenMensual) {
        return new Response(JSON.stringify({ error: 'Falta la pregunta o el resumen mensual' }), { status: 400, headers: corsHeaders })
      }

      const prompt = `Eres una asesora financiera personal para una usuaria dominicana. Tienes este resumen agregado de sus finanzas de los últimos meses — son TOTALES por mes, tipo y categoría, no movimientos individuales:

${JSON.stringify(resumenMensual)}

Pregunta de la usuaria: "${pregunta}"

Instrucciones:
- Responde en español, de forma concisa y directa, usando solo los datos del resumen.
- Si la pregunta es sobre una proyección futura o si puede permitirse una compra, usa la tendencia de ingresos/gastos de estos meses para estimarlo, dejando claro que es una estimación aproximada.
- Si la pregunta requiere datos que no están en este resumen (ej. una transacción específica o una fecha exacta), dilo honestamente en vez de inventar una respuesta.`

      analisis = await llamarGroq(groqApiKey, prompt, 500)

    } else if (modo === 'anomalia') {
      // Explicación de un gasto inusual ya detectado estadísticamente en el cliente.
      // Payload mínimo — no se envían movimientos, solo los números ya agregados.
      const { categoria, montoActual, promedioHistorico, moneda } = body
      if (!categoria || montoActual == null || promedioHistorico == null || !moneda) {
        return new Response(JSON.stringify({ error: 'Datos incompletos para explicar la anomalía' }), { status: 400, headers: corsHeaders })
      }

      const prompt = `Eres una asesora financiera personal para una usuaria dominicana. Detectaste que el gasto en la categoría "${categoria}" este mes fue ${montoActual} ${moneda}, comparado con un promedio histórico de ${promedioHistorico} ${moneda} en esa misma categoría.

Redacta en español una alerta breve (2-3 oraciones), amigable y sin alarmismo, explicando la diferencia y sugiriendo una acción concreta si aplica.`

      analisis = await llamarGroq(groqApiKey, prompt, 200)

    } else {
      // modo 'resumen' — comportamiento original, sin cambios (retrocompatible)
      const { movimientos, periodo } = body

      if (!movimientos || movimientos.length === 0) {
        return new Response(JSON.stringify({ error: 'Sin movimientos para analizar' }), { status: 400, headers: corsHeaders })
      }

      // Resumir movimientos (solo campos relevantes para reducir tokens)
      const resumen = movimientos.map((m: any) => ({
        fecha: m.fecha,
        tipo: m.tipo,
        categoria: m.categorias?.nombre || 'Sin categoría',
        monto: Number(m.monto),
        moneda: m.moneda,
      }))

      const prompt = `Eres una asesora financiera personal para una usuaria dominicana. Analiza los siguientes movimientos del período ${periodo} y proporciona:

1. **Resumen ejecutivo**: balance general en 1-2 oraciones
2. **Top gastos por categoría**: las 3 categorías con más gasto
3. **Observación clave**: algo relevante que notes en el patrón de gastos
4. **2 recomendaciones concretas** para mejorar las finanzas

Responde en español, de forma concisa, amigable y directa. Usa montos reales del análisis.

Movimientos (${resumen.length} registros):
${JSON.stringify(resumen)}`

      analisis = await llamarGroq(groqApiKey, prompt, 600)
    }

    return new Response(JSON.stringify({ analisis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders })
  }
})
