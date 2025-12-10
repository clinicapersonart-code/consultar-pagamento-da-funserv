import { ExtractedRow, PatientSummary } from '../types';

declare const pdfjsLib: any;

// Palavras-chave que indicam que o "NOME" capturado é cabeçalho ou lixo.
const INVALID_NAMES = [
  'TOTAL', 'PAGINA', 'PÁGINA', 'RELATORIO', 'DEMONSTRATIVO', 'BENEFICIARIO', 
  'PACIENTE', 'SUBTOTAL', 'SALDO', 'VALOR', 'PROCESSO', 'DATA', 'FUNSERV'
];

export const processPdfFiles = async (files: File[]): Promise<PatientSummary[]> => {
  const allRows: ExtractedRow[] = [];

  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      const items = textContent.items.map((item: any) => ({
        text: item.str,
        x: item.transform[4],
        y: item.transform[5],
        w: item.width,
        h: item.height
      }));

      // Ordenação: Y decrescente, X crescente
      items.sort((a: any, b: any) => b.y - a.y || a.x - b.x);

      const lines: { y: number; text: string }[] = [];
      const yTolerance = 4;
      let currentLineY = -1000;
      let currentLineText: string[] = [];

      items.forEach((item: any) => {
        if (Math.abs(item.y - currentLineY) > yTolerance) {
          if (currentLineText.length > 0) {
            lines.push({ y: currentLineY, text: currentLineText.join(' ') });
          }
          currentLineY = item.y;
          currentLineText = [];
        }
        currentLineText.push(item.text);
      });
      if (currentLineText.length > 0) {
        lines.push({ y: currentLineY, text: currentLineText.join(' ') });
      }

      lines.forEach(line => {
        const rowData = parseLine(line.text, pageNum);
        if (rowData) {
          allRows.push(rowData);
        }
      });
    }
  }

  return aggregateData(allRows);
};

const parseLine = (line: string, page: number): ExtractedRow | null => {
  const cleanLine = line.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();

  // Busca valores monetários
  const moneyRegex = /(-?[\d\.]+,\d{2})/g;
  const moneyMatches = cleanLine.match(moneyRegex);
  
  if (!moneyMatches || moneyMatches.length === 0) return null;

  const values = moneyMatches.map(valStr => {
    const cleanStr = valStr.replace(/\./g, '').replace(',', '.');
    return parseFloat(cleanStr);
  });

  // Remove datas para evitar confusão com códigos
  const lineWithoutDates = cleanLine.replace(/\d{2}\/\d{2}\/\d{2,4}/g, '           ');

  // Regex: Código (4-20 digitos) + Espaço + Nome (Iniciando com letra maiúscula)
  const codeNameRegex = /(\d{4,20})\s+([A-ZÀ-Ú][A-ZÀ-Ú\s\.]+)/;
  const match = lineWithoutDates.match(codeNameRegex);
  
  if (!match) return null;

  const beneficiaryCode = match[1];
  let patientName = match[2].trim();

  // Limpeza do nome
  patientName = patientName.replace(/\s\d.*$/, ''); 
  patientName = patientName.replace(/[^\wÀ-Ú\s\.]$/g, ''); 

  if (patientName.length < 3) return null;
  
  const upperName = patientName.toUpperCase();
  if (INVALID_NAMES.some(keyword => upperName.startsWith(keyword))) return null;

  return {
    page,
    beneficiaryCode,
    patientName,
    rawLine: cleanLine,
    values
  };
};

const aggregateData = (rows: ExtractedRow[]): PatientSummary[] => {
  const map = new Map<string, PatientSummary>();

  rows.forEach(row => {
    const relevantValues = row.values;
    let paidVal = 0;
    let glosaVal = 0;

    const negativeValues = relevantValues.filter(v => v < 0);
    const positiveValues = relevantValues.filter(v => v > 0);

    if (negativeValues.length > 0) {
      glosaVal = negativeValues.reduce((acc, curr) => acc + Math.abs(curr), 0);
      if (positiveValues.length > 0) {
        paidVal = positiveValues[positiveValues.length - 1];
      }
    } else {
      // Tenta deduzir glosa pela lógica V1 - V2 = V3
      if (relevantValues.length >= 3) {
        const v1 = relevantValues[relevantValues.length - 3];
        const v2 = relevantValues[relevantValues.length - 2];
        const v3 = relevantValues[relevantValues.length - 1];
        if (Math.abs((v1 - v2) - v3) < 0.05) {
          glosaVal = v2;
          paidVal = v3;
        } else {
          paidVal = v3;
        }
      } else if (relevantValues.length >= 1) {
        paidVal = relevantValues[relevantValues.length - 1];
      }
    }

    if (!map.has(row.beneficiaryCode)) {
      map.set(row.beneficiaryCode, {
        id: row.beneficiaryCode,
        name: row.patientName,
        totalProcedures: 0,
        paidProcedures: 0,
        disallowedProcedures: 0,
        totalProcessedValue: 0,
        totalPaidValue: 0,
        totalDisallowedValue: 0
      });
    }

    const patient = map.get(row.beneficiaryCode)!;
    patient.totalProcedures += 1;
    
    // CORREÇÃO CRÍTICA: Somar o valor processado da linha (que é Pago + Glosa)
    // Se o paidVal e glosaVal foram extraídos corretamente, o Processado é a soma.
    patient.totalProcessedValue += (paidVal + glosaVal);
    
    if (paidVal > 0) {
      patient.paidProcedures += 1;
      patient.totalPaidValue += paidVal;
    }
    
    if (glosaVal > 0) {
      patient.disallowedProcedures += 1;
      patient.totalDisallowedValue += glosaVal;
    }
  });

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
};