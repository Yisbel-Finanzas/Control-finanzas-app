import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function useAnalisisIA() {
  const [analisis, setAnalisis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function analizar(movimientos, periodo) {
    setLoading(true)
    setError(null)
    setAnalisis(null)

    const { data, error: fnError } = await supabase.functions.invoke('analizar-gastos', {
      body: { movimientos, periodo },
    })

    setLoading(false)

    if (fnError) {
      setError(fnError.message || 'Error al conectar con la IA')
      return
    }
    if (data?.error) {
      setError(data.error)
      return
    }
    setAnalisis(data?.analisis || null)
  }

  function limpiar() {
    setAnalisis(null)
    setError(null)
  }

  return { analisis, loading, error, analizar, limpiar }
}
