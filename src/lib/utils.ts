import { Vaga, DateGroup } from './types'

export const DIAS_UTEIS = ['Segunda-Feira','Terca-Feira','Quarta-Feira','Quinta-Feira','Sexta_Feira']
export const MESES = ['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

export function isPriority(v: Vaga): boolean {
  return !!v.hora?.startsWith('06:') && DIAS_UTEIS.includes(v.diaSemana)
}

export function fmtTs(iso: string): string {
  if (!iso) return '–'
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) +
    ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function groupVagasByDate(vagas: Vaga[]): DateGroup[] {
  const groups: Record<string, DateGroup> = {}
  for (const v of vagas) {
    if (!groups[v.data]) {
      const [dia, mes, ano] = v.data.split('/')
      groups[v.data] = {
        data: v.data, dia, mes, ano,
        diaSemana: v.diaSemana,
        vagas: [],
        totalRem: 0,
      }
    }
    groups[v.data].vagas.push(v)
    groups[v.data].totalRem += v.vagasRem
  }
  return Object.values(groups).sort((a, b) => {
    const da = a.data.split('/').reverse().join('')
    const db = b.data.split('/').reverse().join('')
    return da.localeCompare(db)
  })
}

export function horaChipState(rem: number): 'many' | 'few' | 'none' {
  if (rem === 0) return 'none'
  if (rem <= 2) return 'few'
  return 'many'
}

export function getDiaNome(diaSemana: string): string {
  const map: Record<string, string> = {
    'Segunda-Feira': 'SEG', 'Terca-Feira': 'TER', 'Quarta-Feira': 'QUA',
    'Quinta-Feira': 'QUI', 'Sexta_Feira': 'SEX', 'Sabado': 'SAB', 'Domingo': 'DOM',
  }
  return map[diaSemana] || diaSemana.substring(0, 3).toUpperCase()
}
