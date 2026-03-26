export interface Vaga {
  key: string
  data: string        // "DD/MM/YYYY"
  hora: string        // "HH:MM:SS"
  diaSemana: string
  posto: string
  vagasRem: number
  vagasAbertas: number
  ts?: string
}

export interface HistoricoItem {
  ts: string
  data: string
  diaSemana: string
  hora: string
  posto: string
  anterior: number
  atual: number
  tipo: string
}

export interface DadosAPI {
  vagas: Vaga[]
  historico: HistoricoItem[]
  mes: string
  ultimoCheck: { ts: string; total: number } | null
}

export interface DateGroup {
  data: string
  dia: string
  mes: string
  ano: string
  diaSemana: string
  vagas: Vaga[]
  totalRem: number
}
