import { SurveyFlowVisualization } from './SurveyFlowVisualization';

export function SurveyVisualizationPage({
  questions,
  title = "Survey Flow Visualization",
  description = "Interactive flowchart showing survey question flow and branching logic",
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="bg-[#0B7A9E] text-white px-6 py-4 shadow-md flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold">{title}</h1>
          <p className="text-sm opacity-90 mt-0.5">{description}</p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-bold px-4 py-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          >
            ✕ Close
          </button>
        )}
      </div>

      {/* Visualization */}
      <div className="flex-1 min-h-0">
        <SurveyFlowVisualization questions={questions} />
      </div>

      {/* Legend */}
      <div className="bg-gray-100 px-6 py-3 border-t border-gray-300 flex flex-wrap items-center gap-6 text-sm shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-4 h-1 bg-[#0B7A9E]" />
          <span className="text-xs text-gray-600">Sequential flow</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-1 bg-[#E63946]" />
          <span className="text-xs text-gray-600">Conditional branch</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#0B7A9E]" />
          <span className="text-xs text-gray-600">Start node</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-5 bg-[#0B7A9E] rounded" />
          <span className="text-xs text-gray-600">Question node</span>
        </div>
        <div className="flex items-center gap-2 ml-auto text-xs text-gray-500">
          <span>Total: {questions.length}</span>
          <span className="mx-1">|</span>
          <span>Control: {questions.filter(q => q.variableRole === 'control').length}</span>
          <span className="mx-1">|</span>
          <span>Dependent: {questions.filter(q => q.variableRole === 'dependent').length}</span>
          <span className="mx-1">|</span>
          <span>Driver: {questions.filter(q => q.variableRole === 'driver').length}</span>
        </div>
      </div>
    </div>
  );
}
