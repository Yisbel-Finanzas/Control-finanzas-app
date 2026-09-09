import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function useAnalisisIA() {
  const [analisis, setAnalisis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function invocar(body) {
    setLoading(true)
    setError(null)
    setAnalisis(null)

    const { data, error: fnError } = await supabase.functions.invoke('analizar-gastos', { body })

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

  async function analizar(movimientos, periodo) {
    await invocar({ modo: 'resumen', movimientos, periodo })
  }

  async function preguntar(pregunta, resumenMensual) {
    await invocar({ modo: 'chat', pregunta, resumenMensual })
  }

  async function explicarAnomalia({ categoria, montoActual, promedioHistorico, moneda }) {
    await invocar({ modo: 'anomalia', categoria, montoActual, promedioHistorico, moneda })
  }

  function limpiar() {
    setAnalisis(null)
    setError(null)
  }

  return { analisis, loading, error, analizar, preguntar, explicarAnomalia, limpiar }
}
