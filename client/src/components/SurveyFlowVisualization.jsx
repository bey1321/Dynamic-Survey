import { useEffect, useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position,
  Handle,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// Custom node component for question nodes
function QuestionNode({ data }) {
  return (
    <>
      <Handle type="target" position={Position.Top} />
      <div className="px-6 py-4 bg-[#0B7A9E] text-white rounded-xl shadow-lg border-2 border-[#095A77] min-w-[220px] max-w-[280px]">
        <div className="font-semibold text-xs mb-2 opacity-90">{data.id}</div>
        <div className="text-sm leading-tight mb-2">{data.label}</div>
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/20">
          <div className="text-[10px] opacity-75 italic">
            {data.type?.replace('_', ' ')}
          </div>
          <div className="text-[10px] px-2 py-0.5 bg-white/20 rounded">
            {data.variableRole}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}

// Custom node component for start node
function StartNode() {
  return (
    <>
      <div className="w-24 h-24 bg-[#0B7A9E] text-white rounded-full shadow-lg border-4 border-[#095A77] flex items-center justify-center">
        <div className="font-bold text-lg">Start</div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}

// Custom node types (defined outside component to avoid re-registration)
const nodeTypes = {
  question: QuestionNode,
  start: StartNode,
};

export function SurveyFlowVisualization({ questions }) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const nodes = [];
    const edges = [];

    let yOffset = 0;
    const xCenter = 400;
    const nodeSpacing = 180;

    // Add start node
    nodes.push({
      id: 'start',
      type: 'start',
      position: { x: xCenter - 50, y: yOffset },
      data: {},
    });

    yOffset += nodeSpacing;

    // Create nodes for each question
    questions.forEach((question, index) => {
      const hasConditional = question.branchCondition !== null;
      const isBranchedTo = question.branchFrom !== null;

      let xPosition = xCenter - 140;
      if (isBranchedTo && hasConditional) {
        xPosition += 250;
      }

      nodes.push({
        id: question.id,
        type: 'question',
        position: { x: xPosition, y: yOffset },
        data: {
          id: question.id,
          label: question.text,
          type: question.type,
          variableRole: question.variableRole,
          hasConditional,
        },
      });

      if (index === 0) {
        edges.push({
          id: `start-${question.id}`,
          source: 'start',
          target: question.id,
          markerEnd: { type: MarkerType.ArrowClosed, color: '#0B7A9E' },
          style: { stroke: '#0B7A9E', strokeWidth: 3 },
        });
      } else {
        const prevQuestion = questions[index - 1];

        if (question.branchFrom && question.branchCondition) {
          const sourceQuestion = questions.find(q => q.id === question.branchCondition.questionId);
          if (sourceQuestion) {
            edges.push({
              id: `${sourceQuestion.id}-${question.id}-conditional`,
              source: sourceQuestion.id,
              target: question.id,
              animated: true,
              label: getConditionLabel(question.branchCondition),
              labelStyle: { fill: '#E63946', fontWeight: 600, fontSize: 12 },
              labelBgStyle: { fill: '#FFF', fillOpacity: 0.9 },
              markerEnd: { type: MarkerType.ArrowClosed, color: '#E63946' },
              style: { stroke: '#E63946', strokeWidth: 3 },
            });
          }

          const sourceQuestionIndex = questions.findIndex(q => q.id === question.branchCondition.questionId);
          if (sourceQuestionIndex !== -1 && sourceQuestionIndex + 1 < questions.length) {
            const nextSequential = questions[sourceQuestionIndex + 1];
            if (nextSequential.id !== question.id && !nextSequential.branchFrom) {
              edges.push({
                id: `${sourceQuestion?.id}-${nextSequential.id}-else`,
                source: sourceQuestion?.id,
                target: nextSequential.id,
                label: 'else',
                labelStyle: { fill: '#0B7A9E', fontWeight: 600, fontSize: 12 },
                labelBgStyle: { fill: '#FFF', fillOpacity: 0.9 },
                markerEnd: { type: MarkerType.ArrowClosed, color: '#0B7A9E' },
                style: { stroke: '#0B7A9E', strokeWidth: 3 },
              });
            }
          }
        } else if (!question.branchFrom) {
          edges.push({
            id: `${prevQuestion.id}-${question.id}`,
            source: prevQuestion.id,
            target: question.id,
            markerEnd: { type: MarkerType.ArrowClosed, color: '#0B7A9E' },
            style: { stroke: '#0B7A9E', strokeWidth: 3 },
          });
        }
      }

      yOffset += nodeSpacing;
    });

    return { nodes, edges };
  }, [questions]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onNodeClick = useCallback((_event, node) => {
    console.log('Clicked node:', node);
  }, []);

  return (
    <div className="w-full h-full bg-gray-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.2}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.7 }}
      >
        <Background color="#aaa" gap={16} />
        <Controls />
        <MiniMap
          nodeColor={() => '#0B7A9E'}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
      </ReactFlow>
    </div>
  );
}

function getConditionLabel(condition) {
  const { operator, value } = condition;
  switch (operator) {
    case 'lte': return `\u2264 ${value}`;
    case 'gte': return `\u2265 ${value}`;
    case 'eq':  return `= ${value}`;
    case 'neq': return `\u2260 ${value}`;
    case 'lt':  return `< ${value}`;
    case 'gt':  return `> ${value}`;
    default:    return value;
  }
}
