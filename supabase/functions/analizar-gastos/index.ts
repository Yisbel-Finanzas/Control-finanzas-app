import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { movimientos, periodo } = await req.json()

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

    const groqApiKey = Deno.env.get('GROQ_API_KEY')
    if (!groqApiKey) return new Response(JSON.stringify({ error: 'API key de Groq no configurada' }), { status: 500, headers: corsHeaders })

    const prompt = `Eres una asesora financiera personal para una usuaria dominicana. Analiza los siguientes movimientos del período ${periodo} y proporciona:

1. **Resumen ejecutivo**: balance general en 1-2 oraciones
2. **Top gastos por categoría**: las 3 categorías con más gasto
3. **Observación clave**: algo relevante que notes en el patrón de gastos
4. **2 recomendaciones concretas** para mejorar las finanzas

Responde en español, de forma concisa, amigable y directa. Usa montos reales del análisis.

Movimientos (${resumen.length} registros):
${JSON.stringify(resumen)}`

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 600,
        temperature: 0.7,
      }),
    })

    if (!groqRes.ok) {
      const err = await groqRes.text()
      return new Response(JSON.stringify({ error: 'Error de Groq: ' + err }), { status: 502, headers: corsHeaders })
    }

    const groqData = await groqRes.json()
    const analisis = groqData.choices?.[0]?.message?.content || 'Sin respuesta'

    return new Response(JSON.stringify({ analisis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders })
  }
})
