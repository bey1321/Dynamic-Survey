import { useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

function QuestionNode({ data }) {
  return (
    <>
      <Handle type="target" position={Position.Top} />
      <div
        dir={data.dir}
        className={`px-6 py-4 bg-[#0B7A9E] text-white rounded-xl shadow-lg border-2 border-[#095A77] min-w-[220px] max-w-[280px] ${
          data.dir === "rtl" ? "text-right" : "text-left"
        }`}
      >
        <div className="font-semibold text-xs mb-2 opacity-90">{data.id}</div>
        <div className="text-sm leading-tight mb-2">{data.label}</div>
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/20">
          <div className="text-[10px] opacity-75 italic">{data.typeLabel}</div>
          <div className="text-[10px] px-2 py-0.5 bg-white/20 rounded">
            {data.variableRoleLabel}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}

function StartNode({ data }) {
  return (
    <>
      <div
        dir={data.dir}
        className="w-24 h-24 bg-[#0B7A9E] text-white rounded-full shadow-lg border-4 border-[#095A77] flex items-center justify-center"
      >
        <div className="font-bold text-lg">{data.label}</div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}

const nodeTypes = {
  question: QuestionNode,
  start: StartNode,
};

function translateVariableRole(role, t) {
  switch (role) {
    case "dependent":
      return t("survey:dependentVariable", { defaultValue: "Dependent Variable" });
    case "driver":
      return t("survey:drivers", { defaultValue: "Drivers" });
    case "control":
      return t("survey:controls", { defaultValue: "Controls" });
    default:
      return role;
  }
}

function translateOptionValue(value, t) {
  if (Array.isArray(value)) {
    return value.map((item) => translateOptionValue(item, t)).join(", ");
  }

  if (typeof value !== "string") return String(value);

  const normalized = value.trim().toLowerCase();

  if (normalized === "yes") return t("survey:yes", { defaultValue: "Yes" });
  if (normalized === "no") return t("survey:no", { defaultValue: "No" });
  if (normalized === "neutral") return t("survey:neutral", { defaultValue: "Neutral" });
  if (normalized === "satisfied") return t("survey:satisfied", { defaultValue: "Satisfied" });
  if (normalized === "dissatisfied")
    return t("survey:dissatisfied", { defaultValue: "Dissatisfied" });
  if (normalized === "very satisfied")
    return t("survey:verySatisfied", { defaultValue: "Very satisfied" });
  if (normalized === "very dissatisfied")
    return t("survey:veryDissatisfied", { defaultValue: "Very dissatisfied" });

  return value;
}

function getConditionLabel(condition, t) {
  const { operator, value } = condition;
  const translatedValue = translateOptionValue(value, t);

  switch (operator) {
    case "lte":
      return `≤ ${translatedValue}`;
    case "gte":
      return `≥ ${translatedValue}`;
    case "eq":
    case "equals":
      return `= ${translatedValue}`;
    case "neq":
    case "not_equals":
      return `≠ ${translatedValue}`;
    case "lt":
      return `< ${translatedValue}`;
    case "gt":
      return `> ${translatedValue}`;
    case "includes":
      return `${t("survey:branchOperators.includes", { defaultValue: "Includes" })}: ${translatedValue}`;
    default:
      return translatedValue;
  }
}

export function SurveyFlowVisualization({ questions }) {
  const { t, i18n } = useTranslation(["common", "survey"]);
  const dir = i18n.language === "ar" ? "rtl" : "ltr";

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const nodes = [];
    const edges = [];

    let yOffset = 0;
    const xCenter = 400;
    const nodeSpacing = 180;

    nodes.push({
      id: "start",
      type: "start",
      position: { x: xCenter - 50, y: yOffset },
      data: {
        label: t("common:start", { defaultValue: "Start" }),
        dir,
      },
    });

    yOffset += nodeSpacing;

    questions.forEach((question, index) => {
      const hasConditional = question.branchCondition !== null;
      const isBranchedTo = question.branchFrom !== null;

      let xPosition = xCenter - 140;
      if (isBranchedTo && hasConditional) {
        xPosition += 250;
      }

      nodes.push({
        id: question.id,
        type: "question",
        position: { x: xPosition, y: yOffset },
        data: {
          id: question.id,
          label: question.text,
          type: question.type,
          typeLabel: t(`survey:questionTypes.${question.type}`, {
            defaultValue: question.type?.replace("_", " "),
          }),
          variableRole: question.variableRole,
          variableRoleLabel: translateVariableRole(question.variableRole, t),
          hasConditional,
          dir,
        },
      });

      if (index === 0) {
        edges.push({
          id: `start-${question.id}`,
          source: "start",
          target: question.id,
          markerEnd: { type: MarkerType.ArrowClosed, color: "#0B7A9E" },
          style: { stroke: "#0B7A9E", strokeWidth: 3 },
        });
      } else {
        const prevQuestion = questions[index - 1];

        if (question.branchFrom && question.branchCondition) {
          const sourceQuestion = questions.find(
            (q) => q.id === question.branchCondition.questionId
          );

          if (sourceQuestion) {
            edges.push({
              id: `${sourceQuestion.id}-${question.id}-conditional`,
              source: sourceQuestion.id,
              target: question.id,
              animated: true,
              label: getConditionLabel(question.branchCondition, t),
              labelStyle: { fill: "#E63946", fontWeight: 600, fontSize: 12 },
              labelBgStyle: { fill: "#FFF", fillOpacity: 0.9 },
              markerEnd: { type: MarkerType.ArrowClosed, color: "#E63946" },
              style: { stroke: "#E63946", strokeWidth: 3 },
            });
          }

          const sourceQuestionIndex = questions.findIndex(
            (q) => q.id === question.branchCondition.questionId
          );

          if (sourceQuestionIndex !== -1 && sourceQuestionIndex + 1 < questions.length) {
            const nextSequential = questions[sourceQuestionIndex + 1];
            if (nextSequential.id !== question.id && !nextSequential.branchFrom) {
              edges.push({
                id: `${sourceQuestion?.id}-${nextSequential.id}-else`,
                source: sourceQuestion?.id,
                target: nextSequential.id,
                label: t("common:else", { defaultValue: "Else" }),
                labelStyle: { fill: "#0B7A9E", fontWeight: 600, fontSize: 12 },
                labelBgStyle: { fill: "#FFF", fillOpacity: 0.9 },
                markerEnd: { type: MarkerType.ArrowClosed, color: "#0B7A9E" },
                style: { stroke: "#0B7A9E", strokeWidth: 3 },
              });
            }
          }
        } else if (!question.branchFrom) {
          edges.push({
            id: `${prevQuestion.id}-${question.id}`,
            source: prevQuestion.id,
            target: question.id,
            markerEnd: { type: MarkerType.ArrowClosed, color: "#0B7A9E" },
            style: { stroke: "#0B7A9E", strokeWidth: 3 },
          });
        }
      }

      yOffset += nodeSpacing;
    });

    return { nodes, edges };
  }, [questions, t, dir]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onNodeClick = useCallback((_event, node) => {
    console.log("Clicked node:", node);
  }, []);

  return (
    <div className="w-full h-full bg-gray-50" dir={dir}>
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
          nodeColor={() => "#0B7A9E"}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
      </ReactFlow>
    </div>
  );
}
