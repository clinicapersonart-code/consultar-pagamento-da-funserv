import * as XLSX from 'xlsx';
import { PatientSummary } from '../types';

export const exportToExcel = (data: PatientSummary[]) => {
  // Format data for Excel
  const formattedData = data.map(item => ({
    'Código': item.id,
    'Paciente': item.name,
    'Total Atendimentos': item.totalProcedures,
    'Atendimentos Pagos': item.paidProcedures,
    'Atendimentos Glosados': item.disallowedProcedures,
    'Valor Total Pago (R$)': item.totalPaidValue,
    'Valor Total Glosado (R$)': item.totalDisallowedValue * -1, // Showing negative for financial clarity in Excel
  }));

  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(formattedData);

  // Auto-width columns roughly
  const wscols = [
    { wch: 15 }, // Code
    { wch: 40 }, // Name
    { wch: 20 }, // Total
    { wch: 20 }, // Paid
    { wch: 20 }, // Glosa
    { wch: 20 }, // Val Paid
    { wch: 20 }, // Val Glosa
  ];
  worksheet['!cols'] = wscols;

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Resumo Funserv');

  // Generate file download
  XLSX.writeFile(workbook, `Analise_Funserv_${new Date().toISOString().slice(0, 10)}.xlsx`);
};
