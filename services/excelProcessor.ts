import * as XLSX from 'xlsx';
import { PatientSummary } from '../types';

const IGNORE_KEYWORDS = [
  '[OUTROS]',
  'TRATAMENTO',
  '(SESSAO)',
  '(SESSÃO)',
  'PSICOTERAPICO',
  'PSICOTERÁPICO',
  'CONSULTA',
  'ABA -'
];

export const processExcelFiles = async (files: File[]): Promise<PatientSummary[]> => {
  const summaries: PatientSummary[] = [];
  const map = new Map<string, PatientSummary>();

  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    // Process the first sheet
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Convert to Array of Arrays
    const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

    if (!rows || rows.length === 0) continue;

    // Detect Columns
    let nameIdx = -1;
    let codeIdx = -1;
    let paidIdx = -1;
    let diffIdx = -1;
    let headerRowIdx = -1;

    // Scan first 20 rows for header
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const row = rows[i];
      const rowStr = row.join(' ').toLowerCase();
      
      // Heuristic keywords based on screenshot
      if (rowStr.includes('beneficiário') || rowStr.includes('paciente') || rowStr.includes('nome')) {
        headerRowIdx = i;
        row.forEach((cell: any, idx: number) => {
          const val = String(cell).toLowerCase();
          if (val.includes('beneficiário') || val.includes('paciente') || val.includes('nome')) nameIdx = idx;
          if (val.includes('código') || val.includes('carteira')) codeIdx = idx;
          if (val.includes('pagto') || val.includes('pago') || val.includes('líquido')) paidIdx = idx;
          if (val.includes('dif') || val.includes('glosa') || val.includes('diferença')) diffIdx = idx;
        });
        break;
      }
    }

    // Fallback if code index not found separately, assume it might be near name
    if (codeIdx === -1 && nameIdx !== -1) codeIdx = nameIdx - 1; 

    if (headerRowIdx === -1) headerRowIdx = 0; 
    
    const startRow = headerRowIdx + 1;

    for (let i = startRow; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      // Extract Name and Code
      let name = nameIdx !== -1 ? row[nameIdx] : '';
      let code = codeIdx !== -1 ? row[codeIdx] : '';
      
      // If code is empty but name has numbers at start, split them
      if (!code && name && typeof name === 'string' && /^\d+/.test(name)) {
        const parts = name.match(/^(\d+)\s+(.+)/);
        if (parts) {
          code = parts[1];
          name = parts[2];
        }
      }

      if (!name || String(name).trim().length < 3) continue;

      // CRITICAL: Ignore description rows
      const upperName = String(name).toUpperCase();
      if (IGNORE_KEYWORDS.some(k => upperName.includes(k))) {
        continue;
      }

      // Extract Values
      let paidVal = 0;
      let glosaVal = 0;

      // If we found specific columns
      if (paidIdx !== -1) {
        paidVal = parseExcelNumber(row[paidIdx]);
      }
      if (diffIdx !== -1) {
        glosaVal = Math.abs(parseExcelNumber(row[diffIdx])); // Diff is usually negative for glosa
      }

      // If we didn't find specific value columns, look at the last columns (Fallback)
      if (paidIdx === -1 && diffIdx === -1) {
         // Filter for numeric cells
         const numericCells = row.filter((c: any) => typeof c === 'number' || (typeof c === 'string' && /^-?\d+([.,]\d+)?$/.test(c.trim())));
         if (numericCells.length >= 1) {
            const lastVal = parseExcelNumber(numericCells[numericCells.length - 1]);
            if (lastVal > 0) paidVal = lastVal;
            
            const negVal = numericCells.find((c: any) => parseExcelNumber(c) < 0);
            if (negVal) glosaVal = Math.abs(parseExcelNumber(negVal));
         }
      }

      // Update Map
      const cleanCode = String(code || name).replace(/[^\d]/g, '').slice(0, 15) || 'S/N';
      const cleanName = String(name).trim();

      if (!map.has(cleanCode)) {
        map.set(cleanCode, {
          id: cleanCode,
          name: cleanName,
          totalProcedures: 0,
          paidProcedures: 0,
          disallowedProcedures: 0,
          totalPaidValue: 0,
          totalDisallowedValue: 0
        });
      }

      const patient = map.get(cleanCode)!;
      patient.totalProcedures += 1;

      if (paidVal > 0) {
        patient.paidProcedures += 1;
        patient.totalPaidValue += paidVal;
      }
      
      if (glosaVal > 0) {
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
    // Handle Brazilian format "1.000,00" or Standard "1000.00"
    if (val.includes(',') && val.includes('.')) {
       // Assuming 1.000,00
       return parseFloat(val.replace(/\./g, '').replace(',', '.'));
    } else if (val.includes(',')) {
       return parseFloat(val.replace(',', '.'));
    }
    return parseFloat(val);
  }
  return 0;
};