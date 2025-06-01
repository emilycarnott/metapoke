// js/modules/tree-renderer.js

import { findNodeById } from './data-utils.js';

export function renderGameTree(options) {
    const {
        gameTreeSvg,
        flatTreeData,
        revealedNodes,
        revealedEdges,
        mysterySpecies,
        guessedSpeciesHistory,
        onNodeClick
    } = options;

    gameTreeSvg.innerHTML = '';

    if (flatTreeData.length === 0) {
        gameTreeSvg.textContent = "Tree data not available.";
        return;
    }

    // Determine nodes to consider for layout. Only revealed ones (as per the new revelation logic).
    const nodesForLayout = new Set(revealedNodes); // Directly use revealedNodes for layout

    if (nodesForLayout.size === 0) {
        gameTreeSvg.innerHTML = '';
        gameTreeSvg.style.height = `0px`;
        return;
    }

    const currentLayoutNodes = flatTreeData.filter(node => nodesForLayout.has(node.id));

    // Calculate depth for each node within its *revealed sub-tree context*
    const nodeDepths = new Map();
    // For this new revelation, the LCA is the 'effective root' of the displayed sub-tree.
    // So, find the LCA (the single family node in revealedNodes) and start depth calculation from there.
    const lcaNode = currentLayoutNodes.find(node => node.type === 'family' && revealedNodes.has(node.id));

    if (lcaNode) {
        calculateDepthForLayout(lcaNode.id, 0, nodeDepths, currentLayoutNodes, flatTreeData);
    } else {
        // Fallback: If for some reason no LCA is revealed yet (e.g., first guess has identical nodes or just species)
        // just calculate depth relative to the highest node in currentLayoutNodes
        currentLayoutNodes.filter(node => !node.parentId || !nodesForLayout.has(node.parentId)).forEach(root => {
            calculateDepthForLayout(root.id, 0, nodeDepths, currentLayoutNodes, flatTreeData);
        });
    }

    function calculateDepthForLayout(nodeId, currentDepth, depthMap, availableNodes, flatTree) {
        if (depthMap.has(nodeId)) return;
        depthMap.set(nodeId, currentDepth);
        availableNodes.filter(n => n.parentId === nodeId).forEach(child => {
            calculateDepthForLayout(child.id, currentDepth + 1, depthMap, availableNodes, flatTree);
        });
    }

    const svgWidth = gameTreeSvg.clientWidth;
    const nodeRadius = 15;
    const nodePadding = 30;
    const levelSpacing = 100;

    const nodesByDepth = new Map();
    currentLayoutNodes.forEach(node => {
        const depth = nodeDepths.get(node.id);
        if (depth !== undefined) {
            if (!nodesByDepth.has(depth)) {
                nodesByDepth.set(depth, []);
            }
            nodesByDepth.get(depth).push(node);
        }
    });

    let maxDepth = 0;
    if (nodesByDepth.size > 0) {
        maxDepth = Math.max(...Array.from(nodesByDepth.keys()));
    }

    let maxNodesInLevel = 0;
    nodesByDepth.forEach(nodes => {
        if (nodes.length > maxNodesInLevel) {
            maxNodesInLevel = nodes.length;
        }
    });
    const minHorizontalNodeSpace = nodeRadius * 2 + nodePadding;
    let effectiveHorizontalSpace = svgWidth / (maxNodesInLevel + 1);
    effectiveHorizontalSpace = Math.max(effectiveHorizontalSpace, minHorizontalNodeSpace);


    const nodePositions = new Map();
    for (let depth = 0; depth <= maxDepth; depth++) {
        const nodesInLevel = nodesByDepth.get(depth) || [];
        nodesInLevel.sort((a, b) => a.id.localeCompare(b.id));

        const levelTotalWidth = nodesInLevel.length * effectiveHorizontalSpace;
        let currentX = (svgWidth - levelTotalWidth) / 2 + effectiveHorizontalSpace / 2;

        nodesInLevel.forEach(node => {
            const x = currentX;
            const y = nodeRadius + (depth * levelSpacing);
            nodePositions.set(node.id, { x, y });
            currentX += effectiveHorizontalSpace;
        });
    }

    const calculatedHeight = nodeRadius + (maxDepth * levelSpacing) + nodeRadius + 20;
    gameTreeSvg.style.height = `${calculatedHeight}px`;
    gameTreeSvg.setAttribute('width', svgWidth);

    // 1. Draw Paths (Links)
    currentLayoutNodes.forEach(node => {
        if (node.parentId && nodesForLayout.has(node.parentId)) { // Only draw if parent is also in the current layout
            const parentPos = nodePositions.get(node.parentId);
            const childPos = nodePositions.get(node.id);

            const edgeId = `${node.parentId}-${node.id}`;
            if (parentPos && childPos && revealedEdges.has(edgeId)) {
                const linkPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
                linkPath.setAttribute('d', `M${parentPos.x},${parentPos.y} L${childPos.x},${childPos.y}`);
                linkPath.classList.add('link-path');
                linkPath.classList.add('revealed-link-path');
                gameTreeSvg.appendChild(linkPath);
            }
        }
    });

    // 2. Draw Nodes (Circles or Rectangles) and Text
    currentLayoutNodes.forEach(node => {
        const pos = nodePositions.get(node.id);
        if (pos) {
            const isMystery = (mysterySpecies && node.id === mysterySpecies.id);
            const isGuessed = guessedSpeciesHistory.includes(node.id);

            const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
            g.classList.add('node-group');
            g.setAttribute('data-node-id', node.id);

            g.addEventListener('click', (event) => {
                event.stopPropagation();
                if (onNodeClick) {
                    onNodeClick(node);
                }
            });

            let shape;
            let nodeNameDisplay = node.name;

            if (node.type === 'family') {
                shape = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                shape.setAttribute('r', nodeRadius);
                shape.setAttribute('cx', pos.x);
                shape.setAttribute('cy', pos.y);
                shape.classList.add('node-circle');
            } else { // Species
                shape = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                const tempTextContent = (isMystery && !isGuessed) ? '???' : node.name;
                const textWidthEstimate = tempTextContent.length * 6 + 10;
                const rectWidth = Math.max(nodeRadius * 2.5, textWidthEstimate);
                const rectHeight = nodeRadius * 2;
                shape.setAttribute('x', pos.x - rectWidth / 2);
                shape.setAttribute('y', pos.y - rectHeight / 2);
                shape.setAttribute('width', rectWidth);
                shape.setAttribute('height', rectHeight);
                shape.setAttribute('rx', 5);
                shape.setAttribute('ry', 5);
                shape.classList.add('node-rect');

                if (isMystery && !isGuessed) {
                    nodeNameDisplay = '???';
                }
            }

            if (isMystery) {
                g.classList.add('mystery-node');
            }
            if (isGuessed) {
                g.classList.add('guessed-node');
            }
            if (!g.classList.contains('mystery-node') && !g.classList.contains('guessed-node')) {
                 g.classList.add('revealed-node');
            }

            g.appendChild(shape);

            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute('x', pos.x);
            text.setAttribute('y', pos.y + 4);
            text.classList.add('node-text');
            text.textContent = nodeNameDisplay;
            g.appendChild(text);

            gameTreeSvg.appendChild(g);
        }
    });
}
