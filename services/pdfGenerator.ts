import { PatientSummary, ProfessionalSummary } from '../types';

declare const jspdf: any;

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export const generatePDF = (
  data: PatientSummary[] | ProfessionalSummary[], 
  mode: 'patients' | 'professionals' = 'patients'
) => {
  const { jsPDF } = jspdf;
  const doc = new jsPDF();

  const title = mode === 'patients' 
    ? 'Relatório por Paciente - FUNSERV' 
    : 'Relatório por Profissional - FUNSERV';

  // --- Header ---
  const pageWidth = doc.internal.pageSize.width;
  
  doc.setFillColor(mode === 'patients' ? 14 : 79, mode === 'patients' ? 165 : 70, mode === 'patients' ? 233 : 229); // Blue for patients, Indigo for pros
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("NeuroAnalyze", 14, 20);
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(title, 14, 28);
  
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 35);

  // --- Summary Section ---
  const totalPaid = data.reduce((acc: number, curr: any) => acc + curr.totalPaidValue, 0);
  const totalGlosa = data.reduce((acc: number, curr: any) => acc + curr.totalDisallowedValue, 0);
  const totalNet = totalPaid - totalGlosa;
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Resumo Geral", 14, 55);

  // Summary Boxes
  const startY = 60;
  
  // Box 1: Recebido
  doc.setFillColor(240, 253, 244); 
  doc.setDrawColor(22, 163, 74);
  doc.roundedRect(14, startY, 55, 25, 3, 3, 'FD');
  doc.setFontSize(10);
  doc.setTextColor(22, 163, 74);
  doc.text("Total Recebido", 19, startY + 8);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(formatCurrency(totalPaid), 19, startY + 18);

  // Box 2: Glosa
  doc.setFillColor(254, 242, 242); 
  doc.setDrawColor(220, 38, 38);
  doc.roundedRect(74, startY, 55, 25, 3, 3, 'FD');
  doc.setFontSize(10);
  doc.setTextColor(220, 38, 38);
  doc.text("Total Glosado", 79, startY + 8);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(formatCurrency(totalGlosa), 79, startY + 18);

  // Box 3: Líquido
  doc.setFillColor(239, 246, 255); 
  doc.setDrawColor(37, 99, 235);
  doc.roundedRect(134, startY, 55, 25, 3, 3, 'FD');
  doc.setFontSize(10);
  doc.setTextColor(37, 99, 235);
  doc.text("Valor Líquido", 139, startY + 8);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(formatCurrency(totalNet), 139, startY + 18);

  // --- Table ---
  let tableHead = [];
  let tableBody = [];
  let colStyles = {};

  if (mode === 'patients') {
    tableHead = [['Cód.', 'Paciente', 'Qtd.', 'Pago', 'Glosa', 'Líquido']];
    tableBody = (data as PatientSummary[]).map(item => [
      item.id,
      item.name,
      item.totalProcedures,
      formatCurrency(item.totalPaidValue),
      item.totalDisallowedValue > 0 ? `-${formatCurrency(item.totalDisallowedValue)}` : '-',
      formatCurrency(item.totalPaidValue - item.totalDisallowedValue)
    ]);
    colStyles = {
      0: { cellWidth: 20 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 15, halign: 'center' },
      3: { cellWidth: 25, halign: 'right' },
      4: { cellWidth: 25, halign: 'right', textColor: [220, 38, 38] },
      5: { cellWidth: 25, halign: 'right', fontStyle: 'bold' }
    };
  } else {
    // Professional Mode
    tableHead = [['Profissional', 'Pacientes', 'Proc.', 'Pago', 'Glosa', 'Líquido']];
    tableBody = (data as ProfessionalSummary[]).map(item => [
      item.name,
      item.patientCount,
      item.totalProcedures,
      formatCurrency(item.totalPaidValue),
      item.totalDisallowedValue > 0 ? `-${formatCurrency(item.totalDisallowedValue)}` : '-',
      formatCurrency(item.totalPaidValue - item.totalDisallowedValue)
    ]);
    colStyles = {
      0: { cellWidth: 'auto', fontStyle: 'bold' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 15, halign: 'center' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 30, halign: 'right', textColor: [220, 38, 38] },
      5: { cellWidth: 30, halign: 'right', fontStyle: 'bold' }
    };
  }

  doc.autoTable({
    startY: 95,
    head: tableHead,
    body: tableBody,
    theme: 'grid',
    headStyles: { 
      fillColor: mode === 'patients' ? [14, 165, 233] : [79, 70, 229], 
      textColor: 255, 
      fontStyle: 'bold' 
    },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: colStyles,
    didDrawPage: function (data: any) {
        const str = 'Página ' + doc.internal.getNumberOfPages();
        doc.setFontSize(10);
        doc.setTextColor(150);
        const pageSize = doc.internal.pageSize;
        const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
        doc.text(str, data.settings.margin.left, pageHeight - 10);
    }
  });

  const filename = mode === 'patients' 
    ? `Relatorio_Pacientes_${new Date().toISOString().slice(0, 10)}.pdf`
    : `Relatorio_Profissionais_${new Date().toISOString().slice(0, 10)}.pdf`;

  doc.save(filename);
};