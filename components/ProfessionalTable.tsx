import React from 'react';
import { ProfessionalSummary } from '../types';
import { UserCheck } from 'lucide-react';

interface ProfessionalTableProps {
  data: ProfessionalSummary[];
}

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const ProfessionalTable: React.FC<ProfessionalTableProps> = ({ data }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200 bg-indigo-50/50">
        <h3 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
          <UserCheck size={20} />
          Relatório de Produção por Profissional
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 font-semibold">Profissional</th>
              <th className="px-6 py-3 font-semibold text-center">Pacientes Vinculados</th>
              <th className="px-6 py-3 font-semibold text-center">Total Procedimentos</th>
              <th className="px-6 py-3 font-semibold text-right">Total Pago</th>
              <th className="px-6 py-3 font-semibold text-right">Total Glosado</th>
              <th className="px-6 py-3 font-semibold text-right">Valor Líquido</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((pro) => (
              <tr key={pro.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-900">{pro.name}</div>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                    {pro.patientCount}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="text-slate-600 font-medium">
                    {pro.totalProcedures}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="text-emerald-600 font-bold">
                    {formatCurrency(pro.totalPaidValue)}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className={`${pro.totalDisallowedValue > 0 ? 'text-red-600' : 'text-slate-300'} font-medium`}>
                    {pro.totalDisallowedValue > 0 ? `-${formatCurrency(pro.totalDisallowedValue)}` : '-'}
                  </div>
                </td>
                <td className="px-6 py-4 text-right font-bold text-slate-800 text-base">
                   {formatCurrency(pro.totalPaidValue - pro.totalDisallowedValue)}
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                  Nenhum profissional cadastrado ou nenhum vínculo realizado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProfessionalTable;