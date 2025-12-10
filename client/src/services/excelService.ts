import * as XLSX from 'xlsx';
import { PatientSummary } from '../types';

export const exportToExcel = (data: PatientSummary[]) => {
  // Format data for Excel
  const formattedData = data.map(item => ({
    'Código': item.id,
    'Paciente': item.name,
    'Total Atendimentos': item.totalProcedures,
    // Valor Processado (Bruto)
    'Valor Processado (R$)': item.totalProcessedValue,
    // Glosa (Negativo)
    'Valor Glosado (R$)': item.totalDisallowedValue * -1, 
    // Líquido (Já é o totalPaidValue)
    'Valor Líquido (R$)': item.totalPaidValue
  }));

  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(formattedData);

  // Auto-width columns roughly
  const wscols = [
    { wch: 15 }, // Code
    { wch: 40 }, // Name
    { wch: 20 }, // Total Proc
    { wch: 20 }, // Processado
    { wch: 20 }, // Glosa
    { wch: 20 }, // Líquido
  ];
  worksheet['!cols'] = wscols;

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Resumo Funserv');

  // Generate file download
  XLSX.writeFile(workbook, `Analise_Funserv_${new Date().toISOString().slice(0, 10)}.xlsx`);
};