import React from 'react';
import { DollarSign, Users, AlertCircle, FileCheck } from 'lucide-react';
import { PatientSummary } from '../types';

interface SummaryCardsProps {
  data: PatientSummary[];
}

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const SummaryCards: React.FC<SummaryCardsProps> = ({ data }) => {
  const totalPaid = data.reduce((acc, curr) => acc + curr.totalPaidValue, 0);
  const totalGlosa = data.reduce((acc, curr) => acc + curr.totalDisallowedValue, 0);
  const totalPatients = data.length;
  const totalProcedures = data.reduce((acc, curr) => acc + curr.totalProcedures, 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div className="bg-emerald-100 p-2 rounded-lg">
            <DollarSign className="text-emerald-600" size={24} />
          </div>
          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">RECEBIDO</span>
        </div>
        <p className="text-slate-500 text-sm font-medium">Total Pago</p>
        <h3 className="text-2xl font-bold text-slate-800">{formatCurrency(totalPaid)}</h3>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div className="bg-red-100 p-2 rounded-lg">
            <AlertCircle className="text-red-600" size={24} />
          </div>
          <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded">GLOSA</span>
        </div>
        <p className="text-slate-500 text-sm font-medium">Total Glosado</p>
        <h3 className="text-2xl font-bold text-red-600">-{formatCurrency(totalGlosa)}</h3>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Users className="text-blue-600" size={24} />
          </div>
        </div>
        <p className="text-slate-500 text-sm font-medium">Pacientes Atendidos</p>
        <h3 className="text-2xl font-bold text-slate-800">{totalPatients}</h3>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div className="bg-indigo-100 p-2 rounded-lg">
            <FileCheck className="text-indigo-600" size={24} />
          </div>
        </div>
        <p className="text-slate-500 text-sm font-medium">Total Procedimentos</p>
        <h3 className="text-2xl font-bold text-slate-800">{totalProcedures}</h3>
      </div>
    </div>
  );
};

export default SummaryCards;
