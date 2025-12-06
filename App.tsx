import React, { useState, useMemo, useEffect } from 'react';
import { FileText, Download, RotateCcw, FileDown, Users, UserPlus, Plus, X } from 'lucide-react';
import FileUpload from './components/FileUpload';
import SummaryCards from './components/SummaryCards';
import DataTable from './components/DataTable';
import ProfessionalTable from './components/ProfessionalTable';
import { processPdfFiles } from './services/pdfProcessor';
import { processExcelFiles } from './services/excelProcessor';
import { exportToExcel } from './services/excelService';
import { generatePDF } from './services/pdfGenerator';
import { PatientSummary, Professional, ProfessionalSummary } from './types';

// Pre-load professionals based on user screenshot
const INITIAL_PROFESSIONALS: Professional[] = [
  { id: '181006', name: 'Bruno Alexandre - CRP 181006' },
  { id: '181575', name: 'Drieli Guimaraes Thimoteo - CRP 181575' },
  { id: '170875', name: 'Geovana Rafaela Aparecida Dias Duarte - CRP 170875' },
  { id: '158139', name: 'Giovana Affonso Petri - CRP 158139' },
  { id: '180776', name: 'Janaina Mendes Davi - CRP 180776' },
  { id: '187833', name: 'Maria Jose Pedroso - CRP 187833' },
  { id: '196674', name: 'Simone Martins De Agrela - CRP 196674' },
  { id: '181817', name: 'Soraia Cristiane De Souza - CRP 181817' },
  { id: '174243', name: 'Stephanie Goncalves Magon - CRP 174243' },
];

function App() {
  // Initialize data from localStorage if available
  const [data, setData] = useState<PatientSummary[]>(() => {
    try {
      const savedData = localStorage.getItem('neuro_patient_data');
      return savedData ? JSON.parse(savedData) : [];
    } catch (e) {
      console.error("Failed to load saved patient data", e);
      return [];
    }
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New State for Professionals
  const [activeTab, setActiveTab] = useState<'patients' | 'professionals'>('patients');
  const [professionals, setProfessionals] = useState<Professional[]>(INITIAL_PROFESSIONALS);
  const [assignments, setAssignments] = useState<Record<string, string>>({}); // patientId -> proId
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProName, setNewProName] = useState('');

  // Load saved professionals and assignments on startup
  useEffect(() => {
    try {
      const savedPros = localStorage.getItem('neuro_professionals');
      const savedAssigns = localStorage.getItem('neuro_assignments');
      
      if (savedPros) {
        setProfessionals(JSON.parse(savedPros));
      }
      if (savedAssigns) {
        setAssignments(JSON.parse(savedAssigns));
      }
    } catch (e) {
      console.error("Failed to load saved data", e);
    }
  }, []);

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem('neuro_professionals', JSON.stringify(professionals));
  }, [professionals]);

  useEffect(() => {
    localStorage.setItem('neuro_assignments', JSON.stringify(assignments));
  }, [assignments]);

  // Persist patient data whenever it changes
  useEffect(() => {
    localStorage.setItem('neuro_patient_data', JSON.stringify(data));
  }, [data]);

  const handleFiles = async (files: File[]) => {
    setIsProcessing(true);
    setError(null);
    try {
      const pdfFiles = files.filter(f => f.type === 'application/pdf');
      const excelFiles = files.filter(f => /\.(xlsx|xls|csv)$/i.test(f.name));
      
      const resultsMap = new Map<string, PatientSummary>();

      // Initialize map with existing data to allow appending new files instead of overwriting
      // If you prefer overwriting, remove this block or create a separate 'Append' vs 'Replace' logic
      data.forEach(item => resultsMap.set(item.id, { ...item }));

      const mergeData = (items: PatientSummary[]) => {
        items.forEach(item => {
          if (resultsMap.has(item.id)) {
            const existing = resultsMap.get(item.id)!;
            existing.totalProcedures += item.totalProcedures;
            existing.paidProcedures += item.paidProcedures;
            existing.disallowedProcedures += item.disallowedProcedures;
            existing.totalPaidValue += item.totalPaidValue;
            existing.totalDisallowedValue += item.totalDisallowedValue;
          } else {
            resultsMap.set(item.id, { ...item });
          }
        });
      };

      if (pdfFiles.length > 0) {
        const pdfResults = await processPdfFiles(pdfFiles);
        mergeData(pdfResults);
      }

      if (excelFiles.length > 0) {
        const excelResults = await processExcelFiles(excelFiles);
        mergeData(excelResults);
      }

      const finalResults = Array.from(resultsMap.values())
        .filter(item => item.id !== 'S/N') // Filter out invalid rows with No Code
        .sort((a, b) => a.name.localeCompare(b.name));

      if (finalResults.length === 0) {
        setError('Não foi possível extrair dados. Verifique se o arquivo possui as colunas de Beneficiário e Valor.');
      } else {
        setData(finalResults);
      }
    } catch (err) {
      console.error(err);
      setError('Ocorreu um erro ao processar os arquivos. Verifique se estão íntegros.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAssign = (patientId: string, professionalId: string) => {
    setAssignments(prev => ({
      ...prev,
      [patientId]: professionalId
    }));
  };

  const handleAddProfessional = () => {
    if (newProName.trim()) {
      setProfessionals(prev => [...prev, { id: Date.now().toString(), name: newProName }]);
      setNewProName('');
      setIsModalOpen(false);
    }
  };

  // Calculate Professional Stats
  const professionalStats = useMemo(() => {
    const statsMap = new Map<string, ProfessionalSummary>();

    // Initialize all professionals with 0
    professionals.forEach(pro => {
      statsMap.set(pro.id, {
        id: pro.id,
        name: pro.name,
        patientCount: 0,
        totalProcedures: 0,
        totalPaidValue: 0,
        totalDisallowedValue: 0
      });
    });

    // Iterate patients and add to assigned professional
    data.forEach(patient => {
      const assignedProId = assignments[patient.id];
      if (assignedProId && statsMap.has(assignedProId)) {
        const proStat = statsMap.get(assignedProId)!;
        proStat.patientCount += 1;
        proStat.totalProcedures += patient.totalProcedures;
        proStat.totalPaidValue += patient.totalPaidValue;
        proStat.totalDisallowedValue += patient.totalDisallowedValue;
      }
    });

    return Array.from(statsMap.values()).sort((a, b) => b.totalPaidValue - a.totalPaidValue);
  }, [data, professionals, assignments]);

  const handleExportExcel = () => {
    if (data.length > 0) exportToExcel(data);
  };

  const handleExportPDF = () => {
    if (data.length > 0) {
      if (activeTab === 'patients') {
        generatePDF(data, 'patients');
      } else {
        generatePDF(professionalStats, 'professionals');
      }
    }
  };

  const handleReset = () => {
    if (window.confirm("Tem certeza que deseja limpar todos os dados da análise? Isso não apaga os profissionais cadastrados.")) {
      setData([]);
      setError(null);
      // Note: We deliberately do NOT reset assignments here so they persist for next analysis
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans relative">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div className="flex items-center gap-3">
            <div className="bg-medical-600 p-3 rounded-xl shadow-lg shadow-medical-500/30">
              <FileText className="text-white" size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">NeuroAnalyze</h1>
              <p className="text-slate-500 text-sm">Leitor de Demonstrativos Funserv</p>
            </div>
          </div>
          
          {data.length > 0 && (
            <div className="flex flex-wrap gap-3">
               <button 
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 font-medium transition-all"
              >
                <RotateCcw size={18} />
                <span className="hidden sm:inline">Nova Análise</span>
              </button>

              <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 font-medium transition-all"
              >
                <UserPlus size={18} />
                <span className="hidden sm:inline">Add Profissional</span>
              </button>
              
              <button 
                onClick={handleExportPDF}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-md shadow-red-600/20 font-medium transition-all"
              >
                <FileDown size={18} />
                <span className="hidden sm:inline">Baixar PDF {activeTab === 'professionals' ? '(Profissionais)' : '(Pacientes)'}</span>
                <span className="inline sm:hidden">PDF</span>
              </button>

              <button 
                onClick={handleExportExcel}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-md shadow-emerald-600/20 font-medium transition-all"
              >
                <Download size={18} />
                <span className="hidden sm:inline">Baixar Excel</span>
                <span className="inline sm:hidden">XLSX</span>
              </button>
            </div>
          )}
        </header>

        {/* Content */}
        <main>
          {data.length === 0 ? (
            <div className="max-w-2xl mx-auto mt-12">
               <FileUpload onFilesSelected={handleFiles} isProcessing={isProcessing} />
               {error && (
                 <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 text-center text-sm">
                   {error}
                 </div>
               )}
            </div>
          ) : (
            <div className="animate-fade-in space-y-6">
              <SummaryCards data={data} />
              
              {/* Tabs */}
              <div className="flex gap-4 border-b border-slate-200">
                <button
                  onClick={() => setActiveTab('patients')}
                  className={`pb-3 px-4 text-sm font-semibold transition-colors border-b-2 ${
                    activeTab === 'patients' 
                      ? 'border-medical-500 text-medical-600' 
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileText size={16} />
                    Lista de Pacientes
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('professionals')}
                  className={`pb-3 px-4 text-sm font-semibold transition-colors border-b-2 ${
                    activeTab === 'professionals' 
                      ? 'border-indigo-500 text-indigo-600' 
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Users size={16} />
                    Relatório por Profissional
                  </div>
                </button>
              </div>

              {/* View Switch */}
              <div className="mt-4">
                 {activeTab === 'patients' ? (
                   <DataTable 
                     data={data} 
                     professionals={professionals} 
                     assignments={assignments}
                     onAssign={handleAssign}
                   />
                 ) : (
                   <ProfessionalTable data={professionalStats} />
                 )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Add Professional Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 m-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800">Adicionar Novo Profissional</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome / CRP</label>
                <input 
                  type="text" 
                  value={newProName}
                  onChange={(e) => setNewProName(e.target.value)}
                  placeholder="Ex: João Silva - CRP 12345"
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-medical-500 focus:border-medical-500 outline-none"
                />
              </div>
              
              <button 
                onClick={handleAddProfessional}
                className="w-full bg-medical-600 text-white font-semibold py-2.5 rounded-lg hover:bg-medical-700 transition-colors flex justify-center items-center gap-2"
              >
                <Plus size={18} />
                Cadastrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;