import { ExtractedRow, PatientSummary } from '../types';

declare const pdfjsLib: any;

// Keywords that indicate a "Description Line" which should be IGNORED.
// Based on user feedback: "10005 [OUTROS] TRATAMENTO...", "ABA - TRATAMENTO..."
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

      // Sort items by Y (descending) then X (ascending)
      // PDF coordinates: (0,0) is bottom-left. Higher Y = Higher on page.
      items.sort((a: any, b: any) => b.y - a.y || a.x - b.x);

      const lines: { y: number; text: string }[] = [];
      const yTolerance = 4; // Tolerance to group items into a single line

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
        // PRE-FILTER: Ignore lines that differ purely by containing description keywords
        const upperLine = line.text.toUpperCase();
        const shouldIgnore = IGNORE_KEYWORDS.some(keyword => upperLine.includes(keyword));

        if (!shouldIgnore) {
          const rowData = parseLine(line.text, pageNum);
          if (rowData) {
            allRows.push(rowData);
          }
        }
      });
    }
  }

  return aggregateData(allRows);
};

// Regex Explanation:
// 1. (\d{4,15}): Beneficiary Code (allows for some variation, usually 7 digits like 1673100)
// 2. \s+: Separator
// 3. ([A-ZÀ-Ú\s\.]+?): Name (Captures Uppercase letters, Accents, dots, spaces). 
//    We use non-greedy match (+?) to stop before the numbers start.
// 4. \s+: Separator
// 5. (?=-?[\d\.]+,\d{2}): Positive Lookahead for the start of monetary values (positive or negative)
const ROW_PATTERN = /(\d{4,15})\s+([A-ZÀ-Ú\s\.]+?)\s+(?=-?[\d\.]+,\d{2})/;

const parseLine = (line: string, page: number): ExtractedRow | null => {
  // Normalize spaces
  const cleanLine = line.replace(/\s+/g, ' ').trim();
  
  const match = cleanLine.match(ROW_PATTERN);
  
  if (!match) return null;

  const beneficiaryCode = match[1];
  let patientName = match[2].trim();

  // Extra cleanup: sometimes the Date attaches to the name if regex is too greedy or spaces are weird
  // If name ends with digits or slash like "NAME 23/10/2025", strip it.
  patientName = patientName.replace(/\s\d{2}\/\d{2}\/\d{4}.*$/, '').trim();

  // Double check: A valid name usually has at least 3 letters and no special chars like brackets
  if (patientName.length < 3 || patientName.includes('[')) return null;

  // Find all monetary values in the string
  // Matches "-40,00", "1.200,50", "0,00", "-1.830,00"
  // The regex needs to handle the dot as thousand separator and comma as decimal
  const moneyRegex = /(-?[\d\.]+,\d{2})/g;
  const moneyMatches = cleanLine.match(moneyRegex);

  if (!moneyMatches || moneyMatches.length === 0) return null;

  const values = moneyMatches.map(valStr => {
    // Remove dots (thousands), replace comma with dot
    const cleanStr = valStr.replace(/\./g, '').replace(',', '.');
    return parseFloat(cleanStr);
  });

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
    let paidVal = 0;
    let glosaVal = 0;
    
    const relevantValues = row.values;
    
    // Logic based on screenshots:
    // Columns are often: [Process Value] [Diff Value] [Paid Value] [Date] [Date]
    // Example row: 40,00  0,00  40,00
    // Example glosa: 40,00 -40,00 0,00 (or similar)
    
    if (relevantValues.length >= 1) {
      // The last monetary value found is typically the "Valor Pagto" (Paid Amount)
      const lastValue = relevantValues[relevantValues.length - 1];
      
      // Calculate Glosa: sum of all NEGATIVE values found in the line
      // Often "Valor Dif." is negative.
      const negativeValues = relevantValues.filter(v => v < 0);
      const totalNegative = negativeValues.reduce((acc, curr) => acc + Math.abs(curr), 0);
      
      glosaVal = totalNegative;

      // Calculate Paid: 
      // Only count the last value as paid if it is positive.
      if (lastValue > 0) {
        paidVal = lastValue;
      }
    }

    if (!map.has(row.beneficiaryCode)) {
      map.set(row.beneficiaryCode, {
        id: row.beneficiaryCode,
        name: row.patientName,
        totalProcedures: 0,
        paidProcedures: 0,
        disallowedProcedures: 0,
        totalPaidValue: 0,
        totalDisallowedValue: 0
      });
    }

    const patient = map.get(row.beneficiaryCode)!;
    patient.totalProcedures += 1;
    
    if (paidVal > 0) {
      patient.paidProcedures += 1;
      patient.totalPaidValue += paidVal;
    }
    
    // If there is a glosa value, or if paid is 0 and it's a valid row, we might count as glosa/issue
    if (glosaVal > 0) {
      patient.disallowedProcedures += 1;
      patient.totalDisallowedValue += glosaVal;
    }
  });

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
};