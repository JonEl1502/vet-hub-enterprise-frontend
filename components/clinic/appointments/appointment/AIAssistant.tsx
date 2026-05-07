import React, { useState } from 'react';
import { Transition } from '@headlessui/react';
import { X, Wand2, Mic, Upload, Send, Loader2, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { dialog } from '../../../../services';

interface Analysis {
  fullAnalysis: string;
  diagnosticSuggestions: string[];
  treatmentRecommendations: string[];
  clinicalInsights: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  taskName: string;
  taskCategory: string;
  petSpecies: string;
  petAge: number;
  onAnalyze: (input: string) => Promise<void>;
  analysis: Analysis | null;
  isAnalyzing: boolean;
}

const AIAssistant: React.FC<Props> = ({
  isOpen,
  onClose,
  taskName,
  taskCategory,
  petSpecies,
  petAge,
  onAnalyze,
  analysis,
  isAnalyzing,
}) => {
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  const handleSubmit = async () => {
    if (input.trim()) {
      await onAnalyze(input);
    }
  };

  const handleStartRecording = async () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      await dialog.alert({
        title: 'Browser not supported',
        message: 'Speech recognition is not supported in your browser. Please use Chrome or Edge.',
        variant: 'warning',
      });
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => prev + (prev ? ' ' : '') + transcript);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setInput(prev => prev + (prev ? '\n' : '') + `[Uploaded file: ${file.name}]`);
    }
  };

  return (
    <Transition show={isOpen} as={React.Fragment}>
      <div className="fixed inset-0 z-50 overflow-hidden">
        {/* Backdrop */}
        <Transition.Child
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        </Transition.Child>

        {/* Panel */}
        <Transition.Child
          enter="transform transition ease-out duration-300"
          enterFrom="translate-x-full"
          enterTo="translate-x-0"
          leave="transform transition ease-in duration-200"
          leaveFrom="translate-x-0"
          leaveTo="translate-x-full"
        >
          <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white dark:bg-zinc-900 shadow-2xl flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-zinc-800 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl shadow-lg">
                    <Sparkles size={20} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-pine dark:text-zinc-100 uppercase">
                      AI Clinical Assistant
                    </h3>
                    <p className="text-[9px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
                      {taskName} • {taskCategory}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/50 dark:hover:bg-zinc-800 rounded-lg transition-all"
                >
                  <X size={20} className="text-slate-400" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Context Info */}
              <div className="bg-slate-50 dark:bg-zinc-800 rounded-xl p-4 border border-slate-200 dark:border-zinc-700">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Patient Context
                </p>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-pine dark:text-zinc-100 font-bold">
                    {petSpecies}
                  </span>
                  <span className="text-slate-300 dark:text-zinc-600">•</span>
                  <span className="text-pine dark:text-zinc-100 font-bold">
                    {petAge} {petAge === 1 ? 'year' : 'years'} old
                  </span>
                </div>
              </div>

              {/* Analysis Results */}
              {analysis && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  {/* Full Analysis */}
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles size={16} className="text-amber-600 dark:text-amber-400" />
                      <h4 className="text-sm font-black text-amber-900 dark:text-amber-100 uppercase tracking-widest">
                        Analysis
                      </h4>
                    </div>
                    <p className="text-sm text-amber-900 dark:text-amber-100 leading-relaxed whitespace-pre-wrap">
                      {analysis.fullAnalysis}
                    </p>
                  </div>

                  {/* Diagnostic Suggestions */}
                  {analysis.diagnosticSuggestions.length > 0 && (
                    <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                      <h4 className="text-sm font-black text-blue-900 dark:text-blue-100 uppercase tracking-widest mb-3">
                        Diagnostic Suggestions
                      </h4>
                      <ul className="space-y-2">
                        {analysis.diagnosticSuggestions.map((suggestion, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-blue-900 dark:text-blue-100">
                            <span className="text-blue-500 font-bold">•</span>
                            <span>{suggestion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Treatment Recommendations */}
                  {analysis.treatmentRecommendations.length > 0 && (
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
                      <h4 className="text-sm font-black text-emerald-900 dark:text-emerald-100 uppercase tracking-widest mb-3">
                        Treatment Recommendations
                      </h4>
                      <ul className="space-y-2">
                        {analysis.treatmentRecommendations.map((rec, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-emerald-900 dark:text-emerald-100">
                            <span className="text-emerald-500 font-bold">•</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Clinical Insights */}
                  {analysis.clinicalInsights && (
                    <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4">
                      <h4 className="text-sm font-black text-purple-900 dark:text-purple-100 uppercase tracking-widest mb-3">
                        Clinical Insights
                      </h4>
                      <p className="text-sm text-purple-900 dark:text-purple-100 leading-relaxed">
                        {analysis.clinicalInsights}
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-6 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50">
              <div className="space-y-3">
                <div className="relative">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Describe observations, symptoms, or ask for clinical insights..."
                    rows={3}
                    className="w-full px-4 py-3 pr-24 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-amber-500/20 resize-none"
                    disabled={isAnalyzing}
                  />
                  <div className="absolute right-2 bottom-2 flex items-center gap-1">
                    <button
                      onClick={handleStartRecording}
                      disabled={isAnalyzing || isRecording}
                      className={`p-2 rounded-lg transition-all ${
                        isRecording
                          ? 'bg-red-500 text-white animate-pulse'
                          : 'hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400'
                      }`}
                      title="Voice input"
                    >
                      <Mic size={16} />
                    </button>
                    <label className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-all cursor-pointer text-slate-400">
                      <Upload size={16} />
                      <input
                        type="file"
                        className="hidden"
                        onChange={handleFileUpload}
                        accept="image/*,.pdf"
                        disabled={isAnalyzing}
                      />
                    </label>
                  </div>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={isAnalyzing || !input.trim()}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-6 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Send size={18} />
                      Analyze with AI
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </Transition.Child>
      </div>
    </Transition>
  );
};

export default AIAssistant;

