export interface PatientSummary {
  id: string; // Usually the beneficiary code
  name: string;
  totalProcedures: number;
  paidProcedures: number;
  disallowedProcedures: number; // Glosas
  totalProcessedValue: number; // Valor Bruto (Pago + Glosa)
  totalPaidValue: number;
  totalDisallowedValue: number;
}

export interface ProcessingStats {
  totalFiles: number;
  totalPages: number;
  totalRowsProcessed: number;
  totalAmountPaid: number;
  totalAmountDisallowed: number;
}

export interface ExtractedRow {
  page: number;
  beneficiaryCode: string;
  patientName: string;
  rawLine: string;
  values: number[]; // All monetary values found at the end of the line
}

export interface Professional {
  id: string;
  name: string;
}

export interface ProfessionalSummary {
  id: string;
  name: string;
  patientCount: number;
  totalProcedures: number;
  totalProcessedValue: number; // <--- ADICIONADO PARA CONSISTÊNCIA
  totalPaidValue: number;
  totalDisallowedValue: number;
}