import React from 'react';
import { PatientSummary, Professional } from '../types';
import { UserPlus } from 'lucide-react';

interface DataTableProps {
  data: PatientSummary[];
  professionals: Professional[];
  assignments: Record<string, string>; // patientId -> professionalId
  onAssign: (patientId: string, professionalId: string) => void;
}

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const DataTable: React.FC<DataTableProps> = ({ data, professionals, assignments, onAssign }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200 flex justify-between items-center">
        <h3 className="text-lg font-bold text-slate-800">Detalhamento por Paciente</h3>
        <span className="text-xs text-slate-400 font-normal">Vincule os pacientes aos profissionais abaixo</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 font-semibold">Paciente</th>
              <th className="px-6 py-3 font-semibold">Profissional Responsável</th>
              <th className="px-6 py-3 font-semibold text-center">Procedimentos</th>
              <th className="px-6 py-3 font-semibold text-right">V. Processado</th>
              <th className="px-6 py-3 font-semibold text-right">Glosado</th>
              <th className="px-6 py-3 font-semibold text-right">Valor Líquido</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((patient) => (
              <tr key={patient.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-medium text-slate-900">{patient.name}</div>
                  <div className="text-xs text-slate-400">Cod: {patient.id}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="relative">
                    <select
                      value={assignments[patient.id] || ''}
                      onChange={(e) => onAssign(patient.id, e.target.value)}
                      className={`block w-full pl-3 pr-8 py-2 text-xs border rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-medical-500 focus:border-medical-500 ${
                        assignments[patient.id] 
                          ? 'bg-medical-50 border-medical-200 text-medical-700 font-medium' 
                          : 'bg-white border-slate-200 text-slate-500'
                      }`}
                    >
                      <option value="">Selecione o Profissional...</option>
                      {professionals.map((pro) => (
                        <option key={pro.id} value={pro.id}>
                          {pro.name}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                      <UserPlus size={14} />
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                    {patient.totalProcedures}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="text-slate-600 font-medium">
                    {formatCurrency(patient.totalProcessedValue)}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className={`${patient.totalDisallowedValue > 0 ? 'text-red-600' : 'text-slate-300'} font-medium`}>
                    {patient.totalDisallowedValue > 0 ? `-${formatCurrency(patient.totalDisallowedValue)}` : '-'}
                  </div>
                  {patient.disallowedProcedures > 0 && (
                    <div className="text-xs text-slate-400">
                      {patient.disallowedProcedures} itens
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 text-right font-bold text-emerald-700">
                   {formatCurrency(patient.totalPaidValue)}
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                  Nenhum dado encontrado. Faça upload do PDF.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataTable;