import * as XLSX from 'xlsx';
import { PatientSummary } from '../types';

const IGNORE_KEYWORDS = [
  '[OUTROS]', 'TRATAMENTO', '(SESSAO)', '(SESSÃO)', 
  'PSICOTERAPICO', 'PSICOTERÁPICO', 'CONSULTA', 'ABA -'
];

export const processExcelFiles = async (files: File[]): Promise<PatientSummary[]> => {
  const map = new Map<string, PatientSummary>();

  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

    if (!rows || rows.length === 0) continue;

    // Detectar Colunas
    let nameIdx = -1;
    let codeIdx = -1;
    let paidIdx = -1;
    let diffIdx = -1; // Glosa
    let procIdx = -1; // Processado / Apresentado
    let headerRowIdx = -1;

    // Escanear primeiras 20 linhas procurando cabeçalho
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const row = rows[i];
      if (!row) continue;
      const rowStr = row.join(' ').toLowerCase();
      
      if (rowStr.includes('beneficiário') || rowStr.includes('paciente') || rowStr.includes('nome')) {
        headerRowIdx = i;
        row.forEach((cell: any, idx: number) => {
          const val = String(cell).toLowerCase();
          if (val.includes('beneficiário') || val.includes('paciente') || val.includes('nome')) nameIdx = idx;
          if (val.includes('código') || val.includes('carteira')) codeIdx = idx;
          
          // Colunas de Valores
          if (val.includes('pagto') || val.includes('pago') || val.includes('líquido')) paidIdx = idx;
          if (val.includes('dif') || val.includes('glosa') || val.includes('diferença')) diffIdx = idx;
          if (val.includes('processado') || val.includes('apresentado') || val.includes('bruto') || val.includes('valor cobrado')) procIdx = idx;
        });
        break;
      }
    }

    if (codeIdx === -1 && nameIdx !== -1) codeIdx = nameIdx - 1; 
    if (headerRowIdx === -1) headerRowIdx = 0; 
    
    const startRow = headerRowIdx + 1;

    for (let i = startRow; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      let name = nameIdx !== -1 ? row[nameIdx] : '';
      let code = codeIdx !== -1 ? row[codeIdx] : '';
      
      // Ajuste se o código estiver grudado no nome
      if (!code && name && typeof name === 'string' && /^\d+/.test(name)) {
        const parts = name.match(/^(\d+)\s+(.+)/);
        if (parts) {
          code = parts[1];
          name = parts[2];
        }
      }

      if (!name || String(name).trim().length < 3) continue;
      if (IGNORE_KEYWORDS.some(k => String(name).toUpperCase().includes(k))) continue;

      // --- LÓGICA DE VALORES ---
      let processedVal = 0;
      let paidVal = 0;
      let glosaVal = 0;

      // 1. Tenta pegar das colunas identificadas
      if (procIdx !== -1) processedVal = parseExcelNumber(row[procIdx]);
      if (paidIdx !== -1) paidVal = parseExcelNumber(row[paidIdx]);
      if (diffIdx !== -1) glosaVal = Math.abs(parseExcelNumber(row[diffIdx]));

      // 2. Se não achou colunas específicas, usa a lógica posicional (numéricos)
      if (paidIdx === -1 && diffIdx === -1 && procIdx === -1) {
         const numericCells = row.filter((c: any) => {
             if (typeof c === 'number') return true;
             if (typeof c === 'string' && /^-?\d{1,3}(\.?\d{3})*,\d{2}$/.test(c.trim())) return true; // Formato BR 1.000,00
             if (typeof c === 'string' && /^-?\d+(\.\d+)?$/.test(c.trim())) return true; // Formato US 1000.00
             return false;
         }).map((c: any) => parseExcelNumber(c));

         if (numericCells.length >= 1) {
            // Lógica: Primeiro = Processado, Último = Pago
            processedVal = numericCells[0];
            paidVal = numericCells[numericCells.length - 1];

            // Tenta achar negativo para glosa
            const negVal = numericCells.find((v: number) => v < 0);
            if (negVal) {
                glosaVal = Math.abs(negVal);
            } else {
                // Se não tem negativo, calcula a diferença
                const diff = processedVal - paidVal;
                if (diff > 0.05) glosaVal = diff;
            }
            
            // Se só tiver 1 valor, Processado = Pago
            if (numericCells.length === 1) {
                processedVal = numericCells[0];
                paidVal = numericCells[0];
                glosaVal = 0;
            }
         }
      }

      // --- FIM LÓGICA DE VALORES ---

      const cleanCode = String(code || name).replace(/[^\d]/g, '').slice(0, 15) || 'S/N';
      const cleanName = String(name).trim();

      if (!map.has(cleanCode)) {
        map.set(cleanCode, {
          id: cleanCode,
          name: cleanName,
          totalProcedures: 0,
          paidProcedures: 0,
          disallowedProcedures: 0,
          totalProcessedValue: 0, // Inicia zero
          totalPaidValue: 0,
          totalDisallowedValue: 0
        });
      }

      const patient = map.get(cleanCode)!;
      patient.totalProcedures += 1;
      
      // Soma os valores
      patient.totalProcessedValue += processedVal;

      if (paidVal > 0) {
        patient.paidProcedures += 1;
        patient.totalPaidValue += paidVal;
      }
      
      if (glosaVal > 0.01) {
        patient.disallowedProcedures += 1;
        patient.totalDisallowedValue += glosaVal;
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
};

const parseExcelNumber = (val: any): number => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    val = val.trim();
    if (val === '') return 0;
    // Formato Brasileiro: 1.000,00 -> remove ponto, troca vírgula por ponto
    if (val.includes(',') && !val.includes('e')) { // 'e' check evita notação científica fake
       return parseFloat(val.replace(/\./g, '').replace(',', '.'));
    }
    return parseFloat(val);
  }
  return 0;
};